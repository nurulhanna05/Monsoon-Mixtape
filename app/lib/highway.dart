// The rhythm-game stage: the band plays on top, and every note in the song
// falls down its lane and lands on the target arrow exactly when you hear
// it. Nobody has to press anything; it's a way to *see* each month of data
// land.
//
// Notes come from the same beats the music is scheduled from (built in
// audio_bridge.js), and are drawn each frame from the audio position.

import 'dart:math';

import 'package:flutter/scheduler.dart';
import 'package:material_ui/material_ui.dart';

import 'mixtape.dart';
import 'models.dart';
import 'theme.dart';

const _lanes = ['melody', 'drums', 'flute', 'gongs'];
const _labels = {
  'melody': ('Melody', 'temperature'),
  'drums': ('Drums', 'rain'),
  'flute': ('Flute', 'haze'),
  'gongs': ('Gong', 'unusual'),
};
// Arrow directions in degrees from "up": left, down, up, right.
const _direction = {'melody': -90.0, 'drums': 180.0, 'flute': 0.0, 'gongs': 90.0};
const _beatsVisible = 6.0; // how far ahead you can see, in months
const _hit = 0.03; // beats after landing before a note disappears

// The stage is always deep space, so notes use the bright night colours.
Color _laneColor(String lane) => night.tiles[lane]!;

class Highway extends StatefulWidget {
  const Highway({super.key, required this.mixtape, this.height = 480});

  final Mixtape mixtape;
  final double height;

  @override
  State<Highway> createState() => _HighwayState();
}

class _HighwayState extends State<Highway> with SingleTickerProviderStateMixin {
  late final Ticker _ticker = createTicker(_tick);
  final _flash = {for (final l in _lanes) l: 0.0}; // target glow, 1 = just hit
  final _big = {for (final l in _lanes) l: false};
  late final _hitListeners = {for (final l in _lanes) l: () => _onHit(l)};
  double _pos = 0;
  Duration _last = Duration.zero;

  Mixtape get m => widget.mixtape;

  @override
  void initState() {
    super.initState();
    _hitListeners.forEach((l, f) => m.hits[l]!.addListener(f));
    m.addListener(_sync);
    _sync();
  }

  @override
  void dispose() {
    m.removeListener(_sync);
    _hitListeners.forEach((l, f) => m.hits[l]!.removeListener(f));
    _ticker.dispose();
    super.dispose();
  }

  void _onHit(String lane) {
    _flash[lane] = 1;
    _big[lane] = lane == 'gongs' && m.lastGongBig;
  }

  // Animate only while music plays; otherwise draw one still frame.
  void _sync() {
    if (m.playing && !_ticker.isActive) {
      _last = Duration.zero;
      _ticker.start();
    } else if (!m.playing && _ticker.isActive) {
      _ticker.stop();
    }
    if (!m.playing && mounted) setState(_readPosition);
  }

  void _readPosition() {
    final count = m.song?.months.length ?? 0;
    _pos = m.finished ? count + 4.0 : m.audio.position().clamp(0, count + 4.0);
  }

  void _tick(Duration now) {
    final dt = _last == Duration.zero ? 0.016 : (now - _last).inMicroseconds / 1e6;
    _last = now;
    setState(() {
      _readPosition();
      for (final l in _lanes) {
        _flash[l] = max(0, _flash[l]! - dt * (_big[l]! ? 1.2 : 4));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Reduced motion: notes step once a month instead of gliding.
    final stepped = MediaQuery.disableAnimationsOf(context);
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Container(
          height: widget.height,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF04102E), Color(0xFF0A2463), nasaBlueDeep],
            ),
          ),
          child: Column(children: [
            // The band from the classic page, playing along on stage.
            SizedBox(
              height: 118,
              child: HtmlElementView.fromTagName(
                tagName: 'div',
                isVisible: true,
                onElementCreated: m.audio.mountBand,
              ),
            ),
            Expanded(
              // Clipped so long flute notes don't draw over the band.
              child: ClipRect(
                child: CustomPaint(
                  size: Size.infinite,
                  painter: _HighwayPainter(
                    song: m.song,
                    chart: m.chart,
                    pos: stepped ? _pos.floorToDouble() : _pos,
                    flash: Map.of(_flash),
                    big: Map.of(_big),
                    layerOn: Map.of(m.layerOn),
                  ),
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(4, 6, 4, 10),
              color: Colors.black.withValues(alpha: 0.25),
              child: Row(children: [
                for (final l in _lanes)
                  Expanded(
                    child: Column(children: [
                      Text(_labels[l]!.$1,
                          style: TextStyle(
                              color: m.layerOn[l]! ? _laneColor(l) : Colors.white38,
                              fontWeight: FontWeight.w700,
                              fontSize: 14)),
                      Text(_labels[l]!.$2, style: const TextStyle(color: Colors.white70, fontSize: 11)),
                    ]),
                  ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _HighwayPainter extends CustomPainter {
  _HighwayPainter({
    required this.song,
    required this.chart,
    required this.pos,
    required this.flash,
    required this.big,
    required this.layerOn,
  });

  final Song? song;
  final List<Note> chart;
  final double pos;
  final Map<String, double> flash;
  final Map<String, bool> big;
  final Map<String, bool> layerOn;

  // One chunky arrow pointing up, in units of its radius.
  static const _arrow = [
    Offset(0, -1),
    Offset(0.9, -0.05),
    Offset(0.38, -0.05),
    Offset(0.38, 0.85),
    Offset(-0.38, 0.85),
    Offset(-0.38, -0.05),
    Offset(-0.9, -0.05),
  ];

  // A few faint stars, the same every frame.
  static final _stars = () {
    final r = Random(7);
    return [for (var i = 0; i < 60; i++) (Offset(r.nextDouble(), r.nextDouble()), r.nextDouble())];
  }();

  Path _arrowPath(Offset c, double r, String lane) {
    final a = _direction[lane]! * pi / 180;
    final ca = cos(a), sa = sin(a);
    final pts = [for (final p in _arrow) c + Offset((p.dx * ca - p.dy * sa) * r, (p.dx * sa + p.dy * ca) * r)];
    return Path()..addPolygon(pts, true);
  }

  void _drawArrow(Canvas canvas, Offset c, double r, String lane, Color fill,
      {double stroke = 2.5, double opacity = 1, double glow = 0}) {
    final path = _arrowPath(c, r, lane);
    if (glow > 0) {
      canvas.drawPath(
          path,
          Paint()
            ..color = fill.withValues(alpha: 0.8 * opacity)
            ..maskFilter = MaskFilter.blur(BlurStyle.normal, glow));
    }
    canvas.drawPath(path, Paint()..color = fill.withValues(alpha: opacity));
    canvas.drawPath(
        path,
        Paint()
          ..color = Colors.white.withValues(alpha: 0.9 * opacity)
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeJoin = StrokeJoin.round);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final laneW = w / _lanes.length;
    final r = min(laneW * 0.22, 20.0); // arrow radius
    final hitY = h - r * 1.5;
    final ppb = hitY / _beatsVisible; // pixels per beat
    double yAt(double t) => hitY - (t - pos) * ppb;
    double xOf(String lane) => (_lanes.indexOf(lane) + 0.5) * laneW;

    for (final (p, b) in _stars) {
      canvas.drawCircle(
          Offset(p.dx * w, p.dy * h), 0.6 + b, Paint()..color = Colors.white.withValues(alpha: 0.15 + b * 0.25));
    }
    // Lane dividers.
    for (var i = 1; i < _lanes.length; i++) {
      canvas.drawRect(Rect.fromLTWH(i * laneW, 0, 1, h), Paint()..color = Colors.white.withValues(alpha: 0.07));
    }

    // Target arrows, glowing when their note lands.
    for (final l in _lanes) {
      final f = flash[l]!;
      final color = _laneColor(l);
      final on = layerOn[l]!;
      final grow = 1 + f * (big[l]! ? 0.35 : 0.12);
      final path = _arrowPath(Offset(xOf(l), hitY), r * 1.12 * grow, l);
      if (f > 0 && on) {
        canvas.drawPath(
            path,
            Paint()
              ..color = color.withValues(alpha: f * 0.9)
              ..maskFilter = MaskFilter.blur(BlurStyle.normal, big[l]! ? 22 : 10));
        canvas.drawPath(path, Paint()..color = color.withValues(alpha: f * 0.6));
      }
      canvas.drawPath(
          path,
          Paint()
            ..color = on ? color.withValues(alpha: 0.85) : Colors.white24
            ..style = PaintingStyle.stroke
            ..strokeWidth = 3
            ..strokeJoin = StrokeJoin.round);
    }

    final s = song;
    if (s == null || chart.isEmpty) {
      final tp = TextPainter(
        text: const TextSpan(
            text: 'Pick a place: its notes will fall here.',
            style: TextStyle(fontFamily: 'Poppins', color: Colors.white70, fontSize: 15)),
        textDirection: TextDirection.ltr,
        textAlign: TextAlign.center,
      )..layout(maxWidth: w - 32);
      tp.paint(canvas, Offset((w - tp.width) / 2, hitY / 2 - tp.height / 2));
      return;
    }

    // Beat lines; a brighter one with the year at each January.
    for (var t = pos.ceil(); t <= pos + _beatsVisible; t++) {
      if (t < 0 || t >= s.months.length) continue;
      final y = yAt(t.toDouble()).roundToDouble();
      final january = s.months[t].month == 1;
      canvas.drawRect(
          Rect.fromLTWH(0, y, w, 1), Paint()..color = Colors.white.withValues(alpha: january ? 0.35 : 0.08));
      if (january) {
        final tp = TextPainter(
          text: TextSpan(
              text: '${s.months[t].year}',
              style: const TextStyle(
                  fontFamily: 'Poppins', color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600)),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(4, y - tp.height - 2));
      }
    }

    // Notes, from the first one not yet gone.
    var lo = 0, hi = chart.length;
    while (lo < hi) {
      final mid = (lo + hi) >> 1;
      if (chart[mid].at + chart[mid].len < pos - _hit) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    for (var k = lo; k < chart.length; k++) {
      final n = chart[k];
      if (n.at > pos + _beatsVisible + 0.5) break;
      if (pos > n.at + n.len + _hit) continue; // landed: gone
      final opacity = layerOn[n.lane]! ? 1.0 : 0.2;
      final c = Offset(xOf(n.lane), yAt(n.at));
      final color = _laneColor(n.lane);

      switch (n.kind) {
        case 'gem':
          // Pale coral for cooler months, NASA red for the hottest.
          final heat = Color.lerp(const Color(0xFFFFD2C9), nasaRedBright, n.heat)!;
          _drawArrow(canvas, c, r, n.lane, heat, opacity: opacity);
        case 'tap':
          _drawArrow(canvas, c, r * 0.55, n.lane, color, stroke: 1.5, opacity: opacity);
        case 'drum':
          _drawArrow(canvas, c, r, n.lane, color, opacity: opacity);
        case 'hold':
          // The tail shrinks into the target while the note is held.
          final head = min(c.dy, hitY);
          final top = hitY - (n.at + n.len - pos) * ppb;
          final tail = n.hazy ? const Color(0xFF7A8295) : color;
          canvas.drawRRect(
            RRect.fromRectAndRadius(Rect.fromLTRB(c.dx - r * 0.3, top, c.dx + r * 0.3, head), Radius.circular(r * 0.3)),
            Paint()..color = tail.withValues(alpha: 0.6 * opacity),
          );
          if (pos < n.at + _hit) _drawArrow(canvas, c, r, n.lane, tail, opacity: opacity);
        case 'tick' || 'kempul':
          _drawArrow(canvas, c, r * (n.kind == 'tick' ? 0.45 : 0.65), n.lane, color,
              stroke: 1.5, opacity: 0.75 * opacity);
        case 'gong':
          // Unusual month: a big glowing arrow, bigger when more unusual.
          _drawArrow(canvas, c, r * min(1.45, 1.1 + n.severity * 0.05), n.lane, color, opacity: opacity, glow: 14);
      }
    }
  }

  @override
  bool shouldRepaint(_HighwayPainter old) => true;
}
