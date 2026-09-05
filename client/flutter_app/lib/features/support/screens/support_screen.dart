import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import 'raise_complaint_screen.dart';

class SupportScreen extends ConsumerStatefulWidget {
  const SupportScreen({super.key});

  @override
  ConsumerState<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends ConsumerState<SupportScreen> {
  static const String discordUrl = 'https://discord.gg/DRxf72naQv';
  static const String supportEmail = 'flaadmin40@gmail.com';
  static const String driveFolderUrl =
      'https://drive.google.com/drive/folders/11B5k-tOHXku9fN9qVXJJb7NPyZc0Gver?usp=sharing';


  List<dynamic> _myTickets = [];
  bool _isLoadingTickets = false;

  @override
  void initState() {
    super.initState();
    _fetchMyTickets();
  }

  Future<void> _fetchMyTickets() async {
    final user = ref.read(authProvider).user;
    if (user?.email == null) return;

    setState(() => _isLoadingTickets = true);
    try {
      final res = await ApiClient().dio.get('/support/tickets/my', queryParameters: {'email': user!.email});
      if (mounted) {
        setState(() {
          _myTickets = res.data?['data']?['tickets'] ?? [];
          _isLoadingTickets = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingTickets = false);
    }
  }

  Future<void> _launchDiscord() async {
    final uri = Uri.parse(discordUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not launch Discord. Link copied to clipboard.')),
        );
        Clipboard.setData(const ClipboardData(text: discordUrl));
      }
    }
  }

  Future<void> _launchEmail() async {
    final uri = Uri.parse('mailto:$supportEmail?subject=FLA%20ESPORTS%20Player%20Support');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (mounted) {
        Clipboard.setData(const ClipboardData(text: supportEmail));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Email address copied to clipboard: flaadmin40@gmail.com')),
        );
      }
    }
  }

  Future<void> _launchRecordingEmail() async {
    final uri = Uri.parse(
      'mailto:$supportEmail?subject=Match%20Recording%20Submission%20-%20FLA%20ESPORTS&body=Player%20IGN:%0AFree%20Fire%20UID:%0ATournament%20Name%20/%20Match%20Time:%0ASlot%20Number:%0AGoogle%20Drive%20or%20Video%20Proof%20Link:%0A',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (mounted) {
        Clipboard.setData(const ClipboardData(text: supportEmail));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Support email copied to clipboard: flaadmin40@gmail.com')),
        );
      }
    }
  }

  Future<void> _launchDriveFolder() async {
    final uri = Uri.parse(driveFolderUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        Clipboard.setData(const ClipboardData(text: driveFolderUrl));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Drive link copied to clipboard!')),
        );
      }
    }
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Help & Support Center',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        backgroundColor: AppColors.surface,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
      ),
      body: RefreshIndicator(
        onRefresh: _fetchMyTickets,
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Hero Banner
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.surface,
                      AppColors.primary.withValues(alpha: 0.12),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border, width: 1),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.headset_mic_rounded, color: AppColors.primary, size: 24),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'How can we help you?',
                                style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Get instant support from our tournament admins',
                                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Mandatory Winner Game Recording Notice Banner
              Container(
                margin: const EdgeInsets.only(top: 14, bottom: 4),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF1F1206),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.6), width: 1),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDC2626).withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.videocam_rounded, color: Color(0xFFEF4444), size: 20),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Mandatory Match Recording Notice',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Winning players must send their game recording to the Support Gmail (flaadmin40@gmail.com) or save directly in our Google Drive folder. A game recording is mandatory and must be submitted through the Support page.',
                            style: TextStyle(
                              fontSize: 11,
                              color: Color(0xFFFDE68A),
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Quick Contact Channels Header
              const Text(
                'Direct Support Channels',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 10),

              // Google Drive Upload Card (Direct Save)
              _buildChannelCard(
                title: 'Official Drive Folder',
                subtitle: 'Save game record video directly in this Google Drive folder',
                actionLabel: 'Open Drive',
                badgeText: 'DIRECT UPLOAD',
                badgeColor: const Color(0xFFF59E0B),
                icon: Icons.cloud_upload_rounded,
                iconColor: const Color(0xFFF59E0B),
                onTap: _launchDriveFolder,
              ),
              const SizedBox(height: 12),

              // Game Recording Submission Card (Mandatory for Winners)
              _buildChannelCard(
                title: 'Send Game Recording',
                subtitle: 'flaadmin40@gmail.com • Winning players must email match video or drive link',
                actionLabel: 'Submit Video',
                badgeText: 'MANDATORY FOR WINNERS',
                badgeColor: const Color(0xFFEF4444),
                icon: Icons.videocam_rounded,
                iconColor: const Color(0xFFEF4444),
                onTap: _launchRecordingEmail,
              ),
              const SizedBox(height: 12),

              // Discord Channel Card
              _buildChannelCard(
                title: 'Official Discord Server',
                subtitle: 'Join community, create tickets & get 24/7 fast moderation',
                actionLabel: 'Join Discord',
                badgeText: 'FASTEST RESPONSE',
                badgeColor: const Color(0xFF5865F2),
                icon: Icons.forum_rounded,
                iconColor: const Color(0xFF5865F2),
                onTap: _launchDiscord,
              ),
              const SizedBox(height: 12),

              // Email Channel Card
              _buildChannelCard(
                title: 'Official Support Email',
                subtitle: 'flaadmin40@gmail.com • For business, payment & account queries',
                actionLabel: 'Email Admin',
                badgeText: 'OFFICIAL',
                badgeColor: AppColors.primary,
                icon: Icons.email_rounded,
                iconColor: AppColors.primary,
                onTap: _launchEmail,
              ),
              const SizedBox(height: 20),

              // Raise a Complaint Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.4), width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.08),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.danger.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.report_problem_rounded, color: AppColors.danger, size: 20),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'Encountered an Issue?',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Have a dispute over match results, room slot, deposit or rule-breakers? Raise an official complaint to receive a dedicated ticket.',
                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const RaiseComplaintScreen()),
                          );
                          _fetchMyTickets();
                        },
                        icon: const Icon(Icons.add_task_rounded, size: 18),
                        label: const Text('Raise a Complaint / Ticket'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: const Color(0xFF0B0E17),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // My Raised Tickets Section
              if (_isLoadingTickets)
                const Center(child: CircularProgressIndicator(color: AppColors.primary))
              else if (_myTickets.isNotEmpty) ...[
                const Text(
                  'My Raised Tickets',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 10),
                ..._myTickets.map((t) => _buildTicketCard(t)),
                const SizedBox(height: 20),
              ],

              // FAQs Header
              const Text(
                'Frequently Asked Questions',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 10),

              _buildFaqTile(
                question: 'When will I get Room ID & Password?',
                answer: 'Custom Room ID and Password are automatically published 10-15 minutes before match start in the "My Matches" section and via in-app notification.',
              ),
              _buildFaqTile(
                question: 'How do wallet deposits and withdrawals work?',
                answer: 'Scan the UPI QR in the Wallet section and enter your 12-digit UTR. For withdrawals, complete KYC and verify your UPI ID for instant processing.',
              ),
              _buildFaqTile(
                question: 'What if someone cheats or uses hacks?',
                answer: 'Take a screenshot/screen record of the match and tap "Raise a Complaint" selecting "Hacking & Fair Play Report". Admins disqualify and ban violators instantly.',
              ),
              _buildFaqTile(
                question: 'How are prizes distributed after a tournament?',
                answer: 'Match results and kill counts are verified by referees within 30 minutes of match completion, and winnings are instantly credited to your tournament wallet.',
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChannelCard({
    required String title,
    required String subtitle,
    required String actionLabel,
    required String badgeText,
    required Color badgeColor,
    required IconData icon,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        title,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: badgeColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        badgeText,
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: badgeColor),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: onTap,
            style: ElevatedButton.styleFrom(
              backgroundColor: iconColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              minimumSize: const Size(0, 32),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
            ),
            child: Text(actionLabel),
          ),
        ],
      ),
    );
  }

  Widget _buildTicketCard(dynamic ticket) {
    final ticketNum = ticket['ticket_number'] ?? 'FLA-TKT';
    final category = ticket['category'] ?? 'Support';
    final subject = ticket['subject'] ?? '';
    final status = (ticket['status'] ?? 'open').toString().toUpperCase();
    final isResolved = status == 'RESOLVED' || status == 'CLOSED';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: isResolved
                  ? AppColors.success.withValues(alpha: 0.15)
                  : AppColors.highlight.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '#$ticketNum',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: isResolved ? AppColors.success : AppColors.highlight,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subject,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  category,
                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: isResolved
                  ? AppColors.success.withValues(alpha: 0.12)
                  : AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              status,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: isResolved ? AppColors.success : AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFaqTile({required String question, required String answer}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          iconColor: AppColors.primary,
          collapsedIconColor: AppColors.textSecondary,
          title: Text(
            question,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
          ),
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 16, right: 16, bottom: 14),
              child: Text(
                answer,
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
