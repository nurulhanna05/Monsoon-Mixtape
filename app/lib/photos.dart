// Under the map: a slideshow of the picked place (landmarks, and rain,
// sunsets or mist where Wikimedia Commons has them). It moves on by itself
// while the song plays and loops; arrows and dots work any time.

import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import 'mixtape.dart';
import 'models.dart';
import 'theme.dart';

const _every = Duration(seconds: 6);

class PhotoShow extends StatefulWidget {
  const PhotoShow({super.key, required this.mixtape});

  final Mixtape mixtape;

  @override
  State<PhotoShow> createState() => _PhotoShowState();
}

class _PhotoShowState extends State<PhotoShow> {
  Timer? _timer;
  String? _town;
  int _shown = 0;

  Mixtape get m => widget.mixtape;
  List<Photo> get _photos => m.photos[_town] ?? const [];

  @override
  void initState() {
    super.initState();
    m.addListener(_sync);
    _sync();
  }

  @override
  void dispose() {
    m.removeListener(_sync);
    _timer?.cancel();
    super.dispose();
  }

  // Start again from the first photo for a new place; run the timer only
  // while the song plays.
  void _sync() {
    final town = m.photoTown?.name;
    if (town != _town) {
      setState(() {
        _town = town;
        _shown = 0;
      });
      // Fetch all of this place's photos now, not one by one mid-song.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        for (final p in _photos) {
          precacheImage(NetworkImage(Mixtape.photoUrl(p).toString()), context);
        }
      });
    }
    if (m.playing && _photos.length > 1) {
      _timer ??= Timer.periodic(_every, (_) => _go(_shown + 1));
    } else {
      _timer?.cancel();
      _timer = null;
    }
  }

  void _go(int i) {
    if (_photos.isEmpty || !mounted) return;
    setState(() => _shown = i % _photos.length);
    // Load the one after, so the next change is instant.
    final next = _photos[(_shown + 1) % _photos.length];
    precacheImage(NetworkImage(Mixtape.photoUrl(next).toString()), context);
  }

  // A tap restarts the countdown, so the photo you chose stays a while.
  void _tap(int i) {
    _timer?.cancel();
    _timer = null;
    _go(i);
    _sync();
  }

  @override
  Widget build(BuildContext context) {
    final c = Palette.of(context);
    final town = m.photoTown;
    final photos = _photos;
    final exact = town != null && m.pickedTown == town;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Icon(Icons.photo_library_rounded, color: c.blue, size: 22),
            const SizedBox(width: 8),
            Expanded(
              child: Semantics(
                header: true,
                child: Text(
                  town == null ? 'Photos of the place' : (exact ? town.name : 'Near here: ${town.name}'),
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            if (photos.length > 1) ...[
              _Arrow(icon: Icons.chevron_left_rounded, label: 'Previous photo', onTap: () => _tap(_shown - 1)),
              _Arrow(icon: Icons.chevron_right_rounded, label: 'Next photo', onTap: () => _tap(_shown + 1)),
            ],
          ]),
          const SizedBox(height: 12),
          AspectRatio(
            aspectRatio: 3 / 2,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: photos.isEmpty
                  ? _Empty(text: town == null ? 'Pick a place to see it here.' : 'No photos of this place yet.')
                  : _Slide(photo: photos[_shown.clamp(0, photos.length - 1)]),
            ),
          ),
          if (photos.length > 1) ...[
            const SizedBox(height: 10),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var i = 0; i < photos.length; i++)
                Semantics(
                  button: true,
                  selected: i == _shown,
                  label: 'Photo ${i + 1} of ${photos.length}',
                  child: GestureDetector(
                    onTap: () => _tap(i),
                    child: MouseRegion(
                      cursor: SystemMouseCursors.click,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                        width: i == _shown ? 22 : 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: i == _shown ? c.blue : c.blue.withValues(alpha: 0.25),
                          borderRadius: BorderRadius.circular(5),
                        ),
                      ),
                    ),
                  ),
                ),
            ]),
          ],
        ]),
      ),
    );
  }
}

class _Slide extends StatelessWidget {
  const _Slide({required this.photo});

  final Photo photo;

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.of(context).disableAnimations;
    return AnimatedSwitcher(
      duration: still ? Duration.zero : const Duration(milliseconds: 700),
      child: Stack(key: ValueKey(photo.file), fit: StackFit.expand, children: [
        Image.network(
          Mixtape.photoUrl(photo).toString(),
          fit: BoxFit.cover,
          semanticLabel: photo.title,
          errorBuilder: (context, error, stack) => const _Empty(text: "This photo didn't load."),
        ),
        // Caption and credit on a dark fade, so they read on any photo.
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            padding: const EdgeInsets.fromLTRB(14, 28, 14, 10),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Color(0xCC000000)],
              ),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(photo.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
              InkWell(
                onTap: () => launchUrl(Uri.parse(photo.source)),
                child: Text('Photo: ${photo.credit} · Wikimedia Commons',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.8),
                        fontSize: 11,
                        decoration: TextDecoration.underline,
                        decorationColor: Colors.white54)),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _Arrow extends StatelessWidget {
  const _Arrow({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) =>
      IconButton(onPressed: onTap, tooltip: label, icon: Icon(icon, color: Palette.of(context).blue));
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final c = Palette.of(context);
    return Container(
      color: c.tint,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(16),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.landscape_rounded, size: 40, color: c.blue.withValues(alpha: 0.5)),
        const SizedBox(height: 8),
        Text(text, textAlign: TextAlign.center, style: TextStyle(color: c.muted)),
      ]),
    );
  }
}
