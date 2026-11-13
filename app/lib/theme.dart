// NASA colours. Text on white uses NASA Red #E4002B (4.8:1 contrast); the
// brighter web red #FC3D21 is only used for decoration.

import 'package:material_ui/material_ui.dart';

const nasaBlue = Color(0xFF0B3D91);
const nasaBlueDeep = Color(0xFF0032A0);
const nasaRed = Color(0xFFE4002B);
const nasaRedBright = Color(0xFFFC3D21);
const nasaBlack = Color(0xFF212121);
// Colours that change between day and night. Get them with Palette.of(context).
class Palette extends ThemeExtension<Palette> {
  const Palette({
    required this.page,
    required this.card,
    required this.panel,
    required this.tint,
    required this.text,
    required this.muted,
    required this.blue,
    required this.red,
    required this.bubble,
    required this.off,
    required this.offBorder,
    required this.tiles,
  });

  final Color page; // behind the cards
  final Color card;
  final Color panel; // boxes inside cards (search, messages, story list)
  final Color tint; // chips, timeline track
  final Color text;
  final Color muted; // secondary text
  final Color blue; // blue text and icons
  final Color red; // red text and icons
  final Color bubble; // the narration bubble
  final Color off; // a tile that's turned off
  final Color offBorder;
  final Map<String, Color> tiles; // one colour per instrument tile

  static Palette of(BuildContext context) => Theme.of(context).extension<Palette>()!;

  @override
  Palette copyWith() => this;

  @override
  Palette lerp(Palette? other, double t) => t < 0.5 || other == null ? this : other;
}

// Day: white cards, NASA Blue and NASA Red. Muted text is 7:1 on white.
const day = Palette(
  page: Color(0xFFF3F5FA),
  card: Colors.white,
  panel: Color(0xFFF3F5FA),
  tint: Color(0xFFE3E9F5),
  text: nasaBlack,
  muted: Color(0xFF555B66),
  blue: nasaBlue,
  red: nasaRed,
  bubble: Colors.white,
  off: Color(0xFFF1F1F1),
  offBorder: Color(0xFFDDDDDD),
  tiles: {
    'melody': nasaRed,
    'drums': nasaBlue,
    'flute': Color(0xFF5B6B85),
    'gongs': Color(0xFF8A5A00),
    'humidity': Color(0xFF00708A),
  },
);

// Night: deep space navy, with lighter blue and red so text stays readable
// (all above 4.5:1 on the cards).
const night = Palette(
  page: Color(0xFF070E22),
  card: Color(0xFF111B3A),
  panel: Color(0xFF0B1430),
  tint: Color(0xFF1C2B55),
  text: Color(0xFFF1F3F8),
  muted: Color(0xFFB3BCCE),
  blue: Color(0xFF9DBBFF),
  red: Color(0xFFFF7A66),
  bubble: Color(0xFF0B1430),
  off: Color(0xFF161F3A),
  offBorder: Color(0xFF27324F),
  tiles: {
    'melody': Color(0xFFFF7A66),
    'drums': Color(0xFF9DBBFF),
    'flute': Color(0xFFB5C0D4),
    'gongs': Color(0xFFF0B44C),
    'humidity': Color(0xFF5CCDE3),
  },
);

ThemeData buildTheme(Brightness brightness) {
  final c = brightness == Brightness.dark ? night : day;
  final scheme = ColorScheme.fromSeed(
    seedColor: nasaBlue,
    brightness: brightness,
    primary: c.blue,
    onPrimary: brightness == Brightness.dark ? nasaBlack : Colors.white,
    secondary: nasaRed,
    onSecondary: Colors.white,
    surface: c.card,
    onSurface: c.text,
  );
  final base = ThemeData(colorScheme: scheme, useMaterial3: true, fontFamily: 'Poppins');
  return base.copyWith(
    extensions: [c],
    scaffoldBackgroundColor: c.page,
    textTheme: base.textTheme.apply(bodyColor: c.text, displayColor: c.text),
    cardTheme: CardThemeData(
      color: c.card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
    dialogTheme: DialogThemeData(backgroundColor: c.card),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: c.card,
      side: BorderSide(color: c.tint, width: 2),
      shape: const StadiumBorder(),
      labelStyle: TextStyle(fontWeight: FontWeight.w600, color: c.blue),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        textStyle: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    sliderTheme: SliderThemeData(
      activeTrackColor: c.blue,
      thumbColor: c.blue,
      inactiveTrackColor: c.tint,
    ),
  );
}
