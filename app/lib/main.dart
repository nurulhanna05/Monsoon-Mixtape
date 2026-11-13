import 'package:material_ui/material_ui.dart';
import 'package:flutter/semantics.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:web/web.dart' as web;

import 'mixtape.dart';
import 'photos.dart';
import 'place_picker.dart';
import 'player.dart';
import 'share.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Build the screen-reader tree straight away instead of waiting for the
  // hidden "Enable accessibility" button to be pressed.
  SemanticsBinding.instance.ensureSemantics();
  runApp(const MixtapeApp());
}

class MixtapeApp extends StatefulWidget {
  const MixtapeApp({super.key});

  @override
  State<MixtapeApp> createState() => _MixtapeAppState();
}

// Day or night is remembered per browser; until someone picks one, the app
// follows the device setting.
const _themeKey = 'monsoon-mixtape-theme';

class _MixtapeAppState extends State<MixtapeApp> {
  final mixtape = Mixtape();
  ThemeMode themeMode = ThemeMode.system;

  @override
  void initState() {
    super.initState();
    mixtape.loadStatic();
    try {
      themeMode = switch (web.window.localStorage.getItem(_themeKey)) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      };
    } catch (_) {
      // Storage blocked (e.g. private window): follow the device.
    }
  }

  void _setNight(bool night) {
    setState(() => themeMode = night ? ThemeMode.dark : ThemeMode.light);
    try {
      web.window.localStorage.setItem(_themeKey, night ? 'dark' : 'light');
    } catch (_) {
      // Not remembered, but still switched for this visit.
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Monsoon Mixtape',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: themeMode,
      home: HomePage(mixtape: mixtape, onSetNight: _setNight),
    );
  }
}

class HomePage extends StatelessWidget {
  HomePage({super.key, required this.mixtape, required this.onSetNight});

  final Mixtape mixtape;
  final void Function(bool night) onSetNight;
  final _playerKey = GlobalKey();

  // On phones the player sits below the map, so scroll to it after a pick.
  void _showPlayer() {
    final ctx = _playerKey.currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 500), curve: Curves.easeOutCubic);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: LayoutBuilder(builder: (context, size) {
        final wide = size.maxWidth >= 1000;
        final picker = PlacePicker(mixtape: mixtape, onPicked: wide ? null : _showPlayer, mapHeight: wide ? null : 300);
        final player = Player(key: _playerKey, mixtape: mixtape);
        final photos = PhotoShow(mixtape: mixtape);
        final gutter = wide ? 24.0 : 16.0;

        return CustomScrollView(slivers: [
          SliverToBoxAdapter(
            child: ListenableBuilder(
              listenable: mixtape,
              builder: (context, _) =>
                  _Header(compact: !wide, onSetNight: onSetNight, shareUrl: mixtape.shareUrl),
            ),
          ),
          SliverPadding(
            padding: EdgeInsets.all(gutter),
            sliver: SliverToBoxAdapter(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1360),
                  child: wide
                      ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          SizedBox(
                            width: 440,
                            child: Column(children: [
                              SizedBox(height: 680, child: picker),
                              SizedBox(height: gutter),
                              photos,
                            ]),
                          ),
                          SizedBox(width: gutter),
                          Expanded(child: player),
                        ])
                      // Phones: picking a place scrolls to the player, so
                      // the photos sit just below it.
                      : Column(children: [picker, SizedBox(height: gutter), player, SizedBox(height: gutter), photos]),
                ),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: _Footer()),
        ]);
      }),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.compact, required this.onSetNight, required this.shareUrl});

  final bool compact;
  final void Function(bool night) onSetNight;
  final String shareUrl;

  @override
  Widget build(BuildContext context) {
    final night = Theme.of(context).brightness == Brightness.dark;
    return Container(
      color: nasaBlue,
      padding: EdgeInsets.symmetric(horizontal: compact ? 16 : 32, vertical: compact ? 16 : 22),
      child: Row(children: [
        Container(
          width: compact ? 44 : 54,
          height: compact ? 44 : 54,
          decoration: const BoxDecoration(color: nasaRed, shape: BoxShape.circle),
          child: Icon(Icons.graphic_eq_rounded, color: Colors.white, size: compact ? 26 : 32),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Semantics(
              header: true,
              child: Text('Monsoon Mixtape',
                  style: TextStyle(
                      color: Colors.white, fontSize: compact ? 22 : 28, fontWeight: FontWeight.w800, height: 1.1)),
            ),
            const SizedBox(height: 2),
            Text("Hear 20 years of Malaysia's weather as a one-minute song",
                style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: compact ? 13 : 15)),
          ]),
        ),
        const SizedBox(width: 8),
        IconButton(
          onPressed: () => onSetNight(!night),
          tooltip: night ? 'Switch to day mode' : 'Switch to night mode',
          icon: Icon(night ? Icons.light_mode_rounded : Icons.dark_mode_rounded, color: Colors.white),
        ),
        SizedBox(width: compact ? 0 : 8),
        compact
            ? IconButton(
                onPressed: () => _showHelp(context),
                tooltip: 'How it works',
                icon: const Icon(Icons.help_outline_rounded, color: Colors.white),
              )
            : OutlinedButton.icon(
                onPressed: () => _showHelp(context),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white54, width: 1.5),
                  shape: const StadiumBorder(),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                ),
                icon: const Icon(Icons.help_outline_rounded),
                label: const Text('How it works', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
        // Scan to open the demo on a phone; tap for a bigger code.
        SizedBox(width: compact ? 0 : 16),
        compact
            ? IconButton(
                onPressed: () => showShare(context, shareUrl),
                tooltip: 'Open on your phone',
                icon: const Icon(Icons.qr_code_2_rounded, color: Colors.white),
              )
            : Tooltip(
                message: 'Scan to open on your phone (tap to enlarge)',
                child: Semantics(
                  button: true,
                  label: 'QR code to open this demo on your phone',
                  child: InkWell(
                    onTap: () => showShare(context, shareUrl),
                    borderRadius: BorderRadius.circular(8),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Text('Scan to\ntry it',
                          textAlign: TextAlign.right,
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12, height: 1.2)),
                      const SizedBox(width: 8),
                      ExcludeSemantics(child: QrBox(data: shareUrl, size: 64)),
                    ]),
                  ),
                ),
              ),
      ]),
    );
  }
}

void _showHelp(BuildContext context) {
  final c = Palette.of(context);
  Widget step(IconData icon, Color color, String title, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CircleAvatar(backgroundColor: color, foregroundColor: Colors.white, child: Icon(icon)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              Text(text, style: TextStyle(color: c.muted, height: 1.4)),
            ]),
          ),
        ]),
      );

  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      title: const Text('How it works', style: TextStyle(fontWeight: FontWeight.w800)),
      content: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            step(Icons.place_rounded, nasaBlue, 'Pick a place',
                'Tap a city, search for one, or tap anywhere on the map of Malaysia.'),
            step(Icons.volume_up_rounded, nasaRed, 'Turn your sound on',
                'Every month from 2006 to 2025 becomes one beat, so 20 years plays in about a minute.'),
            step(Icons.music_note_rounded, day.tiles['melody']!, 'Listen to the weather',
                'Hotter months play higher notes. Rainy months bring more drums. Haze muffles the flute. '
                    'Sticky, humid months echo.'),
            step(Icons.notifications_active_rounded, day.tiles['gongs']!, 'Wait for the gong',
                'A big gong means something unusual happened, like a heatwave or a haze season. '
                    'The speech bubble tells you what.'),
            Text(
              'The weather data comes from NASA POWER, which measures the whole planet from satellites.',
              style: TextStyle(color: c.muted, fontSize: 13),
            ),
          ]),
        ),
      ),
      actions: [FilledButton(onPressed: () => Navigator.pop(context), child: const Text("Let's go!"))],
    ),
  );
}

class _Footer extends StatelessWidget {
  const _Footer();

  @override
  Widget build(BuildContext context) {
    final c = Palette.of(context);
    Widget link(String text, String url) => InkWell(
          onTap: () => launchUrl(Uri.parse(url)),
          child: Text(text,
              style: TextStyle(color: c.blue, decoration: TextDecoration.underline, fontSize: 13)),
        );
    final small = TextStyle(color: c.muted, fontSize: 13);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      child: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 6,
        runSpacing: 4,
        children: [
          Text('Climate data:', style: small),
          link('NASA POWER', 'https://power.larc.nasa.gov/'),
          Text('· Map: ©', style: small),
          link('OpenStreetMap', 'https://www.openstreetmap.org/copyright'),
          Text('contributors · State outlines:', style: small),
          link('geoBoundaries', 'https://www.geoboundaries.org/'),
          Text('·', style: small),
          link('Classic version (more detail)', Uri.base.resolve('/index.html').toString()),
        ],
      ),
    );
  }
}
