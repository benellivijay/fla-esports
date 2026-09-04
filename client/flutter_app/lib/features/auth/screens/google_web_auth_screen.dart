import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:dio/dio.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/theme/app_theme.dart';

class GoogleWebAuthPayload {
  final String? idToken;
  final String? accessToken;
  final String? email;
  final String? displayName;
  final String? photoUrl;
  final String? googleId;

  GoogleWebAuthPayload({
    this.idToken,
    this.accessToken,
    this.email,
    this.displayName,
    this.photoUrl,
    this.googleId,
  });
}

class GoogleWebAuthScreen extends StatefulWidget {
  const GoogleWebAuthScreen({super.key});

  @override
  State<GoogleWebAuthScreen> createState() => _GoogleWebAuthScreenState();
}

class _GoogleWebAuthScreenState extends State<GoogleWebAuthScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  double _progress = 0.0;
  bool _hasReturned = false;

  static const String _redirectUri = 'https://fla-esports-api.onrender.com/api/v1/auth/google/callback';

  @override
  void initState() {
    super.initState();
    final nonce = 'flanonce_${DateTime.now().millisecondsSinceEpoch}';
    final authUrl = Uri.parse(
      'https://accounts.google.com/o/oauth2/v2/auth'
      '?client_id=${ApiEndpoints.googleWebClientId}'
      '&redirect_uri=${Uri.encodeComponent(_redirectUri)}'
      '&response_type=token%20id_token'
      '&scope=email%20profile%20openid'
      '&prompt=select_account'
      '&nonce=$nonce',
    );

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setUserAgent('Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36')
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (progress) {
            if (mounted) {
              setState(() {
                _progress = progress / 100.0;
                _isLoading = progress < 100;
              });
            }
          },
          onPageStarted: (url) {
            _checkRedirect(url);
          },
          onNavigationRequest: (request) {
            if (_checkRedirect(request.url)) {
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(authUrl);
  }

  bool _checkRedirect(String urlString) {
    if (_hasReturned) return true;

    final uri = Uri.tryParse(urlString);
    if (uri == null) return false;

    // Check if redirected back to our callback or contains tokens
    if (urlString.startsWith(_redirectUri) ||
        uri.path.contains('/auth/google/callback') ||
        urlString.contains('id_token=') ||
        urlString.contains('access_token=')) {
      _hasReturned = true;
      _processRedirect(urlString);
      return true;
    }
    return false;
  }

  Future<void> _processRedirect(String urlString) async {
    final uri = Uri.tryParse(urlString);
    if (uri == null) return;

    // Extract tokens from fragment (#id_token=...&access_token=...) or query params
    Map<String, String> params = {};
    if (uri.hasFragment && uri.fragment.isNotEmpty) {
      final pairs = uri.fragment.split('&');
      for (var pair in pairs) {
        final kv = pair.split('=');
        if (kv.length >= 2) {
          params[kv[0]] = Uri.decodeComponent(kv.sublist(1).join('='));
        }
      }
    }
    if (params.isEmpty && uri.hasQuery) {
      params = uri.queryParameters;
    }

    final idToken = params['id_token'];
    final accessToken = params['access_token'];

    // Parse JWT payload if idToken is present
    String? email;
    String? displayName;
    String? photoUrl;
    String? googleId;

    if (idToken != null && idToken.contains('.')) {
      try {
        final parts = idToken.split('.');
        if (parts.length >= 2) {
          final normalized = base64Url.normalize(parts[1]);
          final payloadJson = utf8.decode(base64Url.decode(normalized));
          final map = jsonDecode(payloadJson) as Map<String, dynamic>;
          email = map['email'] as String?;
          displayName = map['name'] as String?;
          photoUrl = map['picture'] as String?;
          googleId = map['sub'] as String?;
        }
      } catch (_) {}
    }

    // Fallback: If email not decoded from idToken but accessToken exists, fetch from Google userinfo API
    if ((email == null || email.isEmpty) && accessToken != null && accessToken.isNotEmpty) {
      try {
        final dio = Dio();
        final userRes = await dio.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
        );
        if (userRes.statusCode == 200 && userRes.data is Map) {
          final map = userRes.data as Map<String, dynamic>;
          email = map['email'] as String?;
          displayName ??= map['name'] as String?;
          photoUrl ??= map['picture'] as String?;
          googleId ??= map['sub'] as String?;
        }
      } catch (_) {}
    }

    final payload = GoogleWebAuthPayload(
      idToken: idToken,
      accessToken: accessToken,
      email: email,
      displayName: displayName,
      photoUrl: photoUrl,
      googleId: googleId,
    );

    if (mounted) {
      Navigator.of(context).pop(payload);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 1,
        title: const Row(
          children: [
            Icon(Icons.lock_outline, size: 16, color: AppColors.primary),
            SizedBox(width: 8),
            Text(
              'Sign in with Google',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(null),
        ),
        bottom: _isLoading
            ? PreferredSize(
                preferredSize: const Size.fromHeight(2.0),
                child: LinearProgressIndicator(
                  value: _progress > 0 ? _progress : null,
                  backgroundColor: Colors.transparent,
                  valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                ),
              )
            : null,
      ),
      body: WebViewWidget(controller: _controller),
    );
  }
}
