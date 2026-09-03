import 'package:flutter/material.dart';

class AppColors {
  // Base Background (screens) & Surfaces
  static const Color background = Color(0xFF0B0E17);
  static const Color surface = Color(0xFF1A2036);
  static const Color surfaceMuted = Color(0xFF222944);
  
  // Hairline Border (roughly 10% opacity white over base)
  static const Color border = Color(0xFF2A3150);
  
  // Primary Accent (Electric blue - buttons, active tabs, links, selected states)
  static const Color primary = Color(0xFF3DDCFF);
  static const Color primaryHover = Color(0xFF33C7E8);
  static const Color accent = Color(0xFF3DDCFF);
  
  // Secondary Accent (Violet - secondary CTAs, gradients)
  static const Color secondary = Color(0xFF7B5CFF);
  static const Color secondaryLight = Color(0xFF9E86FF);
  
  // Highlight (Gold - coins, prize pool numbers, MAX/featured badges)
  static const Color highlight = Color(0xFFF4B33C);
  static const Color gold = Color(0xFFF4B33C);

  // Typography
  static const Color textPrimary = Color(0xFFE8EAF0);
  static const Color textSecondary = Color(0xFF8A8FA3);
  static const Color textMuted = Color(0xFF8A8FA3);

  // Status Colors (Semantic meaning only)
  // Success (slots remaining, verified status, live indicators)
  static const Color success = Color(0xFF2ED47A);
  static const Color successBg = Color(0x242ED47A);
  static const Color successBorder = Color(0x4D2ED47A);

  // Warning / Review (pending status, prize highlight)
  static const Color warning = Color(0xFFF4B33C);
  static const Color warningBg = Color(0x24F4B33C);
  static const Color warningBorder = Color(0x4DF4B33C);

  // Danger (disputed status, errors, destructive actions)
  static const Color danger = Color(0xFFFF5C6C);
  static const Color dangerBg = Color(0x24FF5C6C);
  static const Color dangerBorder = Color(0x4DFF5C6C);
  static const Color error = danger;
  static const Color errorBg = dangerBg;
}

class AppTheme {
  static ThemeData get darkTheme => lightTheme; // Primary dark neon theme

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.background,
      primaryColor: AppColors.primary,
      fontFamily: 'Roboto',
      colorScheme: const ColorScheme.dark(
        primary: AppColors.primary,
        secondary: AppColors.secondary,
        surface: AppColors.surface,
        error: AppColors.danger,
        onPrimary: Color(0xFF0B0E17),
        onSecondary: Colors.white,
        onSurface: AppColors.textPrimary,
        onError: Colors.white,
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 32),
        displayMedium: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 28),
        displaySmall: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 24),
        headlineLarge: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 22),
        headlineMedium: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 20),
        headlineSmall: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 18),
        titleLarge: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 16),
        titleMedium: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
        titleSmall: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w500, fontSize: 12),
        bodyLarge: TextStyle(color: AppColors.textPrimary, fontSize: 14),
        bodyMedium: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        bodySmall: TextStyle(color: AppColors.textMuted, fontSize: 12),
        labelLarge: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
      ),
      
      // Dark Neon App Bar with Hairline Border
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        shape: Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
        iconTheme: IconThemeData(color: AppColors.textSecondary, size: 20),
      ),

      // Dark Elevated Card Theme with 12px corners & 0.5px border
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border, width: 0.5),
        ),
      ),

      // Input Decoration (Dark Elevated Surface, 0.5px border)
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
        hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
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
          borderSide: const BorderSide(color: AppColors.primary, width: 1.2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.danger, width: 0.5),
        ),
      ),

      // Electric Blue Primary Button Theme
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: AppColors.primary,
          foregroundColor: const Color(0xFF0B0E17),
          disabledBackgroundColor: AppColors.surfaceMuted,
          disabledForegroundColor: AppColors.textMuted,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          elevation: 0,
          foregroundColor: AppColors.primary,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          side: const BorderSide(color: AppColors.border, width: 0.5),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),

      chipTheme: const ChipThemeData(
        backgroundColor: AppColors.surfaceMuted,
        disabledColor: AppColors.surfaceMuted,
        selectedColor: AppColors.primary,
        secondarySelectedColor: AppColors.primary,
        padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        labelStyle: TextStyle(fontSize: 12, color: AppColors.textSecondary),
        secondaryLabelStyle: TextStyle(fontSize: 12, color: Color(0xFF0B0E17)),
        shape: StadiumBorder(),
        side: BorderSide(color: AppColors.border, width: 0.5),
        elevation: 0,
      ),

      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textSecondary,
        elevation: 0,
        type: BottomNavigationBarType.fixed,
      ),

      dialogTheme: const DialogTheme(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
          side: BorderSide(color: AppColors.border, width: 0.5),
        ),
      ),

      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          side: BorderSide(color: AppColors.border, width: 0.5),
        ),
      ),

      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 0.5,
        space: 1,
      ),
    );
  }

  // Consistent card box decoration helper (Dark Elevated Surface, 0.5px border, 12px corners)
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
      borderRadius: BorderRadius.circular(999),
      border: Border.all(
        color: borderColor,
        width: 0.5,
      ),
    );
  }
}
