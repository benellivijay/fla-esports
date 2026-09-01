import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  // Background & Surfaces
  static const Color background = Color(0xFFF8FAFC);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFF1F5F9);
  
  // 0.5px Hairline Border
  static const Color border = Color(0xFFE2E8F0);
  
  // Primary & Secondary Actions
  static const Color primary = Color(0xFF0F172A); // Dark slate primary accent
  static const Color primaryHover = Color(0xFF1E293B);
  static const Color accent = Color(0xFF2563EB); // Electric blue primary accent option
  static const Color secondary = Color(0xFF64748B); // Muted gray
  static const Color secondaryLight = Color(0xFFE2E8F0);
  
  // Typography
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF475569);
  static const Color textMuted = Color(0xFF94A3B8);

  // Status Colors (Strictly reserved for status states)
  static const Color success = Color(0xFF16A34A); // Green (success / verified / released)
  static const Color successBg = Color(0xFFF0FDF4);
  static const Color successBorder = Color(0xFFBBF7D0);

  static const Color warning = Color(0xFFD97706); // Amber (pending / unreleased / review)
  static const Color warningBg = Color(0xFFFFFBEB);
  static const Color warningBorder = Color(0xFFFDE68A);

  static const Color danger = Color(0xFFDC2626); // Red (danger / rejected / not set / full)
  static const Color dangerBg = Color(0xFFFEF2F2);
  static const Color dangerBorder = Color(0xFFFECACA);
}

class AppTheme {
  static ThemeData get lightTheme {
    final baseTextTheme = GoogleFonts.newsreaderTextTheme();

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.background,
      primaryColor: AppColors.primary,
      textTheme: baseTextTheme.copyWith(
        displayLarge: GoogleFonts.newsreader(color: AppColors.textPrimary, fontWeight: FontWeight.w700),
        displayMedium: GoogleFonts.newsreader(color: AppColors.textPrimary, fontWeight: FontWeight.w700),
        displaySmall: GoogleFonts.newsreader(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
        headlineLarge: GoogleFonts.newsreader(color: AppColors.textPrimary, fontWeight: FontWeight.w700),
        headlineMedium: GoogleFonts.newsreader(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
        headlineSmall: GoogleFonts.newsreader(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
        titleLarge: GoogleFonts.newsreader(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
        titleMedium: GoogleFonts.newsreader(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
        titleSmall: GoogleFonts.newsreader(color: AppColors.textPrimary, fontWeight: FontWeight.w500),
        bodyLarge: GoogleFonts.newsreader(color: AppColors.textPrimary),
        bodyMedium: GoogleFonts.newsreader(color: AppColors.textSecondary),
        bodySmall: GoogleFonts.newsreader(color: AppColors.textMuted),
        labelLarge: GoogleFonts.newsreader(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
      ),
      
      // Flat App Bar with Hairline Border
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        shape: const Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
        titleTextStyle: GoogleFonts.newsreader(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
        iconTheme: const IconThemeData(color: AppColors.textPrimary, size: 20),
      ),

      // Flat Card Theme with 12px corners & 0.5px border
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border, width: 0.5),
        ),
      ),

      // Input Decoration (Flat, 0.5px border)
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        labelStyle: GoogleFonts.newsreader(color: AppColors.textSecondary, fontSize: 14),
        hintStyle: GoogleFonts.newsreader(color: AppColors.textMuted, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border, width: 0.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border, width: 0.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.0),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.danger, width: 0.5),
        ),
      ),

      // Pill Buttons Theme
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.surfaceMuted,
          disabledForegroundColor: AppColors.textMuted,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: const StadiumBorder(), // Pill shape
          textStyle: GoogleFonts.newsreader(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          elevation: 0,
          foregroundColor: AppColors.textPrimary,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          side: const BorderSide(color: AppColors.border, width: 0.5),
          shape: const StadiumBorder(), // Pill shape
          textStyle: GoogleFonts.newsreader(fontSize: 14, fontWeight: FontWeight.w500),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          textStyle: GoogleFonts.newsreader(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceMuted,
        disabledColor: AppColors.surfaceMuted,
        selectedColor: AppColors.primary,
        secondarySelectedColor: AppColors.primary,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        labelStyle: GoogleFonts.newsreader(fontSize: 12, color: AppColors.textSecondary),
        secondaryLabelStyle: GoogleFonts.newsreader(fontSize: 12, color: Colors.white),
        shape: const StadiumBorder(),
        side: const BorderSide(color: AppColors.border, width: 0.5),
        elevation: 0,
      ),
    );
  }

  // Consistent card box decoration helper (Flat, 0.5px border, 12px corners)
  static BoxDecoration cardDecoration({Color? color, double borderRadius = 12}) {
    return BoxDecoration(
      color: color ?? AppColors.surface,
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(
        color: AppColors.border,
        width: 0.5,
      ),
    );
  }

  // Status tag helper (Pill shaped, subtle background tint)
  static BoxDecoration statusTagDecoration({
    required Color backgroundColor,
    required Color borderColor,
  }) {
    return BoxDecoration(
      color: backgroundColor,
      borderRadius: BorderRadius.circular(999), // Pill
      border: Border.all(
        color: borderColor,
        width: 0.5,
      ),
    );
  }
}
