// NASA colours. Text on white uses NASA Red #E4002B (4.8:1 contrast); the
// brighter web red #FC3D21 is only used for decoration.

import 'package:material_ui/material_ui.dart';

const nasaBlue = Color(0xFF0B3D91);
const nasaBlueDeep = Color(0xFF0032A0);
const nasaRed = Color(0xFFE4002B);
const nasaRedBright = Color(0xFFFC3D21);
const nasaBlack = Color(0xFF212121);
const paper = Color(0xFFF3F5FA); // page background, a whisper of blue
const softBlue = Color(0xFFE3E9F5); // tinted panels
const muted = Color(0xFF555B66); // secondary text, 7:1 on white

// One colour per instrument tile.
const tileColors = {
  'melody': nasaRed,
  'drums': nasaBlue,
  'flute': Color(0xFF5B6B85),
  'gongs': Color(0xFF8A5A00),
  'humidity': Color(0xFF00708A),
};

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: nasaBlue,
    primary: nasaBlue,
    onPrimary: Colors.white,
    secondary: nasaRed,
    onSecondary: Colors.white,
    surface: Colors.white,
    onSurface: nasaBlack,
  );
  final base = ThemeData(colorScheme: scheme, useMaterial3: true, fontFamily: 'Poppins');
  return base.copyWith(
    scaffoldBackgroundColor: paper,
    textTheme: base.textTheme.apply(bodyColor: nasaBlack, displayColor: nasaBlack),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: Colors.white,
      side: const BorderSide(color: softBlue, width: 2),
      shape: const StadiumBorder(),
      labelStyle: const TextStyle(fontWeight: FontWeight.w600, color: nasaBlue),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        textStyle: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    sliderTheme: const SliderThemeData(
      activeTrackColor: nasaBlue,
      thumbColor: nasaBlue,
      inactiveTrackColor: softBlue,
    ),
  );
}
