// Step 2: listen. The month you're hearing, the narration as a chat, one
// tile per instrument (tap to turn it off), a timeline and big controls.

import 'package:material_ui/material_ui.dart';

import 'highway.dart';
import 'mixtape.dart';
import 'models.dart';
import 'place_picker.dart';
import 'theme.dart';
import 'words.dart';

class Player extends StatelessWidget {
  const Player({super.key, required this.mixtape});

  final Mixtape mixtape;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: ListenableBuilder(
          listenable: mixtape,
          builder: (context, _) {
            final song = mixtape.song;
            return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const StepTitle(number: 2, text: 'Listen'),
              const SizedBox(height: 16),
              if (mixtape.error != null)
                _Message(
                  icon: Icons.cloud_off_rounded,
                  title: "Couldn't load this place",
                  text: '${mixtape.error}\nTry one of the city buttons: they work without internet.',
                  color: nasaRed,
                )
              else if (mixtape.loading)
                _Message(
                  icon: Icons.satellite_alt_rounded,
                  title: 'Asking NASA about ${mixtape.pickedName ?? 'this place'}…',
                  text: 'Fetching 20 years of satellite weather data.',
                  busy: true,
                )
              else if (song == null)
                const _Message(
                  icon: Icons.headphones_rounded,
                  title: 'Pick a place to start',
                  text: 'Turn your sound on, then choose a city or tap the map.\n'
                      'The song starts by itself.',
                )
              else
                _Playing(mixtape: mixtape, song: song),
            ]);
          },
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message(
      {required this.icon, required this.title, required this.text, this.color = nasaBlue, this.busy = false});

  final IconData icon;
  final String title;
  final String text;
  final Color color;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final c = Palette.of(context);
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 56, horizontal: 24),
        decoration: BoxDecoration(color: c.panel, borderRadius: BorderRadius.circular(20)),
        child: Column(children: [
          SizedBox(
            width: 96,
            height: 96,
            child: Stack(alignment: Alignment.center, children: [
              if (busy) const SizedBox.expand(child: CircularProgressIndicator(strokeWidth: 4, color: nasaRed)),
              CircleAvatar(
                radius: 38,
                backgroundColor: color,
                foregroundColor: Colors.white,
                child: Icon(icon, size: 38),
              ),
            ]),
          ),
          const SizedBox(height: 18),
          Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(text, textAlign: TextAlign.center, style: TextStyle(color: c.muted, fontSize: 15, height: 1.5)),
        ]),
      ),
    );
  }
}

class _Playing extends StatelessWidget {
  const _Playing({required this.mixtape, required this.song});

  final Mixtape mixtape;
  final Song song;

  @override
  Widget build(BuildContext context) {
    final c = Palette.of(context);
    final m = song.months[mixtape.index];

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // Place and quick facts.
      Wrap(crossAxisAlignment: WrapCrossAlignment.end, spacing: 12, runSpacing: 4, children: [
        Text(song.place, style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, height: 1.1)),
        Padding(
          padding: const EdgeInsets.only(bottom: 3),
          child: Text('${song.start}–${song.end} · played on the ${leadNames[song.lead]}',
              style: TextStyle(color: c.muted, fontSize: 15)),
        ),
      ]),
      const SizedBox(height: 12),
      Wrap(spacing: 8, runSpacing: 8, children: [
        _Fact(
            Icons.thermostat_rounded,
            song.tempChange >= 0
                ? '${song.tempChange.toStringAsFixed(1)}°C warmer than in ${song.start}'
                : '${(-song.tempChange).toStringAsFixed(1)}°C cooler than in ${song.start}'),
        _Fact(Icons.wb_sunny_rounded, 'Hottest year: ${song.hottestYear}'),
        _Fact(Icons.umbrella_rounded, 'Wettest year: ${song.wettestYear}'),
        _Fact(Icons.notifications_active_rounded, '${song.unusualCount} gong moments'),
      ]),
      const SizedBox(height: 20),

      // Now playing (the month and the narration as a chat) beside the
      // rhythm-game stage; stacked on narrow screens.
      LayoutBuilder(builder: (context, size) {
        final wide = size.maxWidth >= 720;
        final nowPlaying = Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                colors: [nasaBlue, nasaBlueDeep], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(22),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('NOW PLAYING',
                style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.75),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5)),
            // One line each, shrunk to fit: if "September 2008" wrapped on a
            // phone, the box would grow and the page jump every month.
            SizedBox(
                height: 46, // fixed, so a shrunk title doesn't change the height either
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(monthTitle(m),
                      maxLines: 1,
                      style:
                          const TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.w800, height: 1.2)),
                )),
            SizedBox(
                height: 22,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(seasonNames[m.season] ?? '',
                      maxLines: 1, style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 15)),
                )),
            const SizedBox(height: 12),
            if (wide)
              Expanded(child: _Chat(mixtape: mixtape, song: song))
            else
              SizedBox(height: 280, child: _Chat(mixtape: mixtape, song: song)),
          ]),
        );
        if (!wide) {
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            nowPlaying,
            const SizedBox(height: 16),
            Highway(mixtape: mixtape, height: 470),
          ]);
        }
        return SizedBox(
          height: 470,
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(flex: 4, child: nowPlaying),
            const SizedBox(width: 16),
            Expanded(flex: 5, child: Highway(mixtape: mixtape, height: 470)),
          ]),
        );
      }),
      const SizedBox(height: 20),

      // The band: one tile per sound.
      Row(children: [
        const Text('The band', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(width: 10),
        Flexible(
            child: Text('Tap a tile to turn that sound off or on', style: TextStyle(color: c.muted, fontSize: 13))),
      ]),
      const SizedBox(height: 10),
      LayoutBuilder(builder: (context, size) {
        final perRow = size.maxWidth >= 760 ? 5 : (size.maxWidth >= 460 ? 3 : 2);
        final width = (size.maxWidth - 10 * (perRow - 1)) / perRow;
        Widget tile(String layer, IconData icon, String data, String value, String word, String sound) => SizedBox(
              width: width,
              child: _BandTile(
                  mixtape: mixtape, layer: layer, icon: icon, data: data, value: value, word: word, sound: sound),
            );
        return Wrap(spacing: 10, runSpacing: 10, children: [
          tile('melody', Icons.thermostat_rounded, 'Temperature', '${m.temp.toStringAsFixed(1)}°C', tempWord(song, m),
              'Melody: hotter = higher'),
          tile('drums', Icons.water_drop_rounded, 'Rain', '${m.rain.toStringAsFixed(1)} mm a day', rainWord(song, m),
              'Drums: rainier = busier'),
          tile('flute', Icons.blur_on_rounded, 'Haze', m.aod.toStringAsFixed(2), hazeWord(song, m),
              'Flute: hazy = muffled'),
          tile('humidity', Icons.cloud_rounded, 'Humidity', '${m.humidity.round()}%', humidityWord(song, m),
              'Echo: humid = more echo'),
          tile('gongs', Icons.notifications_active_rounded, 'Unusual?', m.flags.isEmpty ? 'No' : 'Yes!', gongWord(m),
              'Gong: something unusual'),
        ]);
      }),
      const SizedBox(height: 22),

      _Timeline(mixtape: mixtape, song: song),
      const SizedBox(height: 14),
      _Controls(mixtape: mixtape),
      const SizedBox(height: 12),
      _Story(mixtape: mixtape, song: song),
    ]);
  }
}

class _Fact extends StatelessWidget {
  const _Fact(this.icon, this.text);

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = Palette.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(30)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 17, color: c.blue),
        const SizedBox(width: 6),
        Text(text, style: TextStyle(color: c.blue, fontWeight: FontWeight.w600, fontSize: 13)),
      ]),
    );
  }
}

// The narration as a chat: each line arrives as a new bubble at the bottom
// and stays, so you can scroll back through the whole story.
class _Chat extends StatefulWidget {
  const _Chat({required this.mixtape, required this.song});

  final Mixtape mixtape;
  final Song song;

  @override
  State<_Chat> createState() => _ChatState();
}

class _ChatState extends State<_Chat> {
  final scroll = ScrollController();
  int _count = 0; // lines shown last time, to spot a new one

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  // Lines reached so far (all of them once the song has finished).
  List<Line> get _shown => widget.mixtape.finished
      ? widget.song.lines
      : widget.song.lines.where((l) => l.index <= widget.mixtape.index).toList();

  @override
  void didUpdateWidget(_Chat old) {
    super.didUpdateWidget(old);
    final newSong = old.song != widget.song;
    final count = _shown.length;
    final grew = count > _count;
    _count = count;
    if (!newSong && !grew) return;
    // A new line: follow it down, unless the reader has scrolled up to read.
    // (The new bubble isn't laid out yet, so "at the bottom" is measured
    // before it arrives.)
    final atBottom = !scroll.hasClients || scroll.position.extentAfter < 80;
    if (!newSong && !atBottom) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!scroll.hasClients) return;
      final end = scroll.position.maxScrollExtent;
      if (MediaQuery.disableAnimationsOf(context) || newSong) {
        scroll.jumpTo(end);
      } else {
        scroll.animateTo(end, duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final song = widget.song;
    final shown = _shown;
    final next = widget.mixtape.finished ? null : song.stories.where((l) => l.index > widget.mixtape.index).firstOrNull;

    return RawScrollbar(
      controller: scroll,
      thumbVisibility: true,
      thumbColor: Colors.white.withValues(alpha: 0.45),
      radius: const Radius.circular(4),
      thickness: 6,
      child: ListView(
        controller: scroll,
        padding: const EdgeInsets.only(right: 14),
        children: [
          for (final (i, line) in shown.indexed)
            _Bubble(
              key: ValueKey(line),
              line: line,
              when: line.isStory ? monthTitle(song.months[line.index]) : null,
              newest: i == shown.length - 1,
            ),
          // Like a "typing…" hint: what's coming next.
          if (next != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 2, 0, 4),
              child: Row(children: [
                Icon(Icons.headphones_rounded, size: 16, color: Colors.white.withValues(alpha: 0.7)),
                const SizedBox(width: 6),
                Flexible(
                  child: Text('Next gong moment: ${monthTitle(song.months[next.index])}',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 13)),
                ),
              ]),
            ),
        ],
      ),
    );
  }
}

// One narration line in the chat. Slides in when it first appears.
class _Bubble extends StatelessWidget {
  const _Bubble({super.key, required this.line, this.when, this.newest = false});

  final Line line;
  final String? when; // the month, for gong moments
  final bool newest; // read out by screen readers

  @override
  Widget build(BuildContext context) {
    final c = Palette.of(context);
    final story = line.isStory;
    return Semantics(
      liveRegion: newest,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
        builder: (context, t, child) => Opacity(
          opacity: t,
          child: Transform.translate(offset: Offset(0, 12 * (1 - t)), child: child),
        ),
        child: Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: c.bubble,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(4),
              topRight: Radius.circular(18),
              bottomLeft: Radius.circular(18),
              bottomRight: Radius.circular(18),
            ),
            border: Border(left: BorderSide(color: story ? nasaRedBright : c.blue, width: 5)),
          ),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(story ? Icons.notifications_active_rounded : Icons.record_voice_over_rounded,
                color: story ? c.red : c.blue, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (when != null)
                  Text(when!, style: TextStyle(color: c.red, fontSize: 12, fontWeight: FontWeight.w700)),
                Text(line.text, style: const TextStyle(fontSize: 15, height: 1.45, fontWeight: FontWeight.w500)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

// One sound in the band. Bounces when it plays; tap to turn it off or on.
class _BandTile extends StatefulWidget {
  const _BandTile({
    required this.mixtape,
    required this.layer,
    required this.icon,
    required this.data,
    required this.value,
    required this.word,
    required this.sound,
  });

  final Mixtape mixtape;
  final String layer;
  final IconData icon;
  final String data;
  final String value;
  final String word;
  final String sound;

  @override
  State<_BandTile> createState() => _BandTileState();
}

class _BandTileState extends State<_BandTile> with SingleTickerProviderStateMixin {
  late final bounce = AnimationController(vsync: this, duration: const Duration(milliseconds: 260));

  @override
  void initState() {
    super.initState();
    widget.mixtape.hits[widget.layer]!.addListener(_onHit);
  }

  @override
  void dispose() {
    widget.mixtape.hits[widget.layer]!.removeListener(_onHit);
    bounce.dispose();
    super.dispose();
  }

  void _onHit() {
    if (!mounted || MediaQuery.disableAnimationsOf(context)) return;
    final big = widget.layer == 'gongs' && widget.mixtape.lastGongBig;
    bounce.duration = Duration(milliseconds: big ? 900 : 260);
    bounce.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final on = widget.mixtape.layerOn[widget.layer]!;
    final c = Palette.of(context);
    final color = c.tiles[widget.layer]!;

    return Semantics(
      toggled: on,
      label: '${widget.data}: ${widget.value}, ${widget.word}. ${widget.sound}. ${on ? 'Sound on' : 'Sound off'}.',
      excludeSemantics: true,
      button: true,
      child: AnimatedBuilder(
        animation: bounce,
        builder: (context, child) {
          // A quick pop that settles back: 0 → 1 → 0.
          final t = bounce.isAnimating ? Curves.easeOut.transform(1 - bounce.value) : 0.0;
          return Transform.scale(scale: 1 + 0.05 * t, child: child);
        },
        child: Material(
          color: on ? color.withValues(alpha: 0.08) : c.off,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: on ? color.withValues(alpha: 0.35) : c.offBorder, width: 2),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => widget.mixtape.toggleLayer(widget.layer),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  AnimatedBuilder(
                    animation: bounce,
                    builder: (context, _) => CircleAvatar(
                      radius: 18,
                      backgroundColor: on
                          ? Color.lerp(
                              day.tiles[widget.layer], nasaRedBright, bounce.isAnimating ? 1 - bounce.value : 0)
                          : Colors.grey,
                      foregroundColor: Colors.white,
                      child: Icon(widget.icon, size: 20),
                    ),
                  ),
                  const Spacer(),
                  Icon(on ? Icons.volume_up_rounded : Icons.volume_off_rounded, size: 20, color: on ? color : c.muted),
                ]),
                const SizedBox(height: 10),
                Text(widget.data, style: TextStyle(color: c.muted, fontSize: 13, fontWeight: FontWeight.w600)),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(widget.value,
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: on ? c.text : c.muted)),
                ),
                Text(widget.word,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: on ? color : c.muted)),
                const SizedBox(height: 8),
                Text(on ? widget.sound : 'Sound off: tap to turn on',
                    style: TextStyle(fontSize: 12, color: c.muted, height: 1.3)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

// The whole 20 years as one bar. Red dots mark the stories; tap or drag to
// jump to a month.
class _Timeline extends StatelessWidget {
  const _Timeline({required this.mixtape, required this.song});

  final Mixtape mixtape;
  final Song song;

  @override
  Widget build(BuildContext context) {
    final count = song.months.length;
    final stories = [for (final l in song.stories) l.index];

    return LayoutBuilder(builder: (context, size) {
      final width = size.maxWidth;
      int indexAt(double x) => (x / width * count).floor().clamp(0, count - 1);

      return Semantics(
        slider: true,
        label: 'Timeline',
        value: monthTitle(song.months[mixtape.index]),
        increasedValue: monthTitle(song.months[(mixtape.index + 12).clamp(0, count - 1)]),
        decreasedValue: monthTitle(song.months[(mixtape.index - 12).clamp(0, count - 1)]),
        onIncrease: () => mixtape.seek(mixtape.index + 12),
        onDecrease: () => mixtape.seek(mixtape.index - 12),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (d) => mixtape.seek(indexAt(d.localPosition.dx)),
          onHorizontalDragUpdate: (d) => mixtape.seek(indexAt(d.localPosition.dx)),
          child: MouseRegion(
            cursor: SystemMouseCursors.click,
            child: SizedBox(
              height: 58,
              child: CustomPaint(painter: _TimelinePainter(song, mixtape.index, stories, Palette.of(context))),
            ),
          ),
        ),
      );
    });
  }
}

class _TimelinePainter extends CustomPainter {
  _TimelinePainter(this.song, this.index, this.stories, this.c);

  final Song song;
  final int index;
  final List<int> stories;
  final Palette c;

  @override
  void paint(Canvas canvas, Size size) {
    final count = song.months.length;
    const barTop = 14.0, barHeight = 14.0;
    final bar = RRect.fromRectAndRadius(Rect.fromLTWH(0, barTop, size.width, barHeight), const Radius.circular(7));
    double x(int i) => (i + 0.5) / count * size.width;

    canvas.drawRRect(bar, Paint()..color = c.tint);
    canvas.save();
    canvas.clipRRect(bar);
    canvas.drawRect(Rect.fromLTWH(0, barTop, x(index), barHeight), Paint()..color = c.blue);
    canvas.restore();

    // Story dots above the bar.
    for (final s in stories) {
      canvas.drawCircle(
          Offset(x(s), 6), 4.5, Paint()..color = s <= index ? c.red : nasaRedBright.withValues(alpha: 0.55));
    }

    // Playhead.
    canvas.drawCircle(Offset(x(index), barTop + barHeight / 2), 11, Paint()..color = c.card);
    canvas.drawCircle(
        Offset(x(index), barTop + barHeight / 2),
        11,
        Paint()
          ..color = nasaRed
          ..style = PaintingStyle.stroke
          ..strokeWidth = 4);

    // Year labels every 5 years.
    for (var i = 0; i < count; i++) {
      final m = song.months[i];
      if (m.month != 1 || (m.year - song.start) % 5 != 0) continue;
      final tp = TextPainter(
        text: TextSpan(text: '${m.year}', style: TextStyle(fontFamily: 'Poppins', color: c.muted, fontSize: 12)),
        textDirection: TextDirection.ltr,
      )..layout();
      final left = (i / count * size.width).clamp(0.0, size.width - tp.width);
      tp.paint(canvas, Offset(left, barTop + barHeight + 8));
    }
  }

  @override
  bool shouldRepaint(_TimelinePainter old) => old.index != index || old.song != song || old.c != c;
}

class _Controls extends StatelessWidget {
  const _Controls({required this.mixtape});

  final Mixtape mixtape;

  @override
  Widget build(BuildContext context) {
    final c = Palette.of(context);
    final playing = mixtape.playing;
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      alignment: WrapAlignment.spaceBetween,
      spacing: 16,
      runSpacing: 14,
      children: [
        Row(mainAxisSize: MainAxisSize.min, children: [
          IconButton.filledTonal(
            onPressed: () => mixtape.jumpStory(-1),
            tooltip: 'Previous gong moment',
            icon: const Icon(Icons.skip_previous_rounded),
          ),
          const SizedBox(width: 10),
          Semantics(
            button: true,
            label: playing ? 'Pause' : (mixtape.finished ? 'Play again' : 'Play'),
            excludeSemantics: true,
            child: SizedBox(
              width: 76,
              height: 76,
              child: FilledButton(
                onPressed: mixtape.togglePlay,
                style: FilledButton.styleFrom(
                  backgroundColor: nasaRed,
                  shape: const CircleBorder(),
                  padding: EdgeInsets.zero,
                  elevation: 3,
                ),
                child: Icon(
                    playing
                        ? Icons.pause_rounded
                        : (mixtape.finished ? Icons.replay_rounded : Icons.play_arrow_rounded),
                    size: 44,
                    color: Colors.white),
              ),
            ),
          ),
          const SizedBox(width: 10),
          IconButton.filledTonal(
            onPressed: () => mixtape.jumpStory(1),
            tooltip: 'Next gong moment',
            icon: const Icon(Icons.skip_next_rounded),
          ),
          const SizedBox(width: 6),
          IconButton(
            onPressed: mixtape.restart,
            tooltip: 'Start again',
            icon: Icon(Icons.restart_alt_rounded, color: c.blue),
          ),
        ]),
        Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.speed_rounded, color: c.blue, size: 20),
          const SizedBox(width: 6),
          SegmentedButton<double>(
            showSelectedIcon: false,
            style: SegmentedButton.styleFrom(
              selectedBackgroundColor: nasaBlue,
              selectedForegroundColor: Colors.white,
              foregroundColor: c.blue,
              textStyle: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600),
            ),
            segments: const [
              ButtonSegment(value: 0.5, label: Text('Slow')),
              ButtonSegment(value: 1, label: Text('Normal')),
              ButtonSegment(value: 1.5, label: Text('Fast')),
            ],
            selected: {mixtape.tempo},
            onSelectionChanged: (s) => mixtape.setTempo(s.first),
          ),
        ]),
        Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(mixtape.volume == 0 ? Icons.volume_off_rounded : Icons.volume_up_rounded, color: c.blue, size: 22),
          SizedBox(
            width: 150,
            child: Slider(
              value: mixtape.volume,
              max: 100,
              divisions: 20,
              label: '${mixtape.volume.round()}%',
              semanticFormatterCallback: (v) => 'Volume ${v.round()}%',
              onChanged: mixtape.setVolume,
            ),
          ),
        ]),
      ],
    );
  }
}

// Every line the narrator says, so you can read ahead or jump to one.
class _Story extends StatelessWidget {
  const _Story({required this.mixtape, required this.song});

  final Mixtape mixtape;
  final Song song;

  @override
  Widget build(BuildContext context) {
    final c = Palette.of(context);
    final current = song.lineAt(mixtape.index);
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: Container(
        decoration: BoxDecoration(color: c.panel, borderRadius: BorderRadius.circular(18)),
        child: ExpansionTile(
          shape: const RoundedRectangleBorder(),
          leading: Icon(Icons.menu_book_rounded, color: c.blue),
          title: const Text('Read the whole story', style: TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text('${song.stories.length} moments. Tap one to jump there.',
              style: TextStyle(color: c.muted, fontSize: 13)),
          childrenPadding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
          children: [
            for (final l in song.lines)
              ListTile(
                dense: true,
                selected: l == current,
                selectedTileColor: c.tint,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                leading: Icon(l.isStory ? Icons.notifications_active_rounded : Icons.record_voice_over_rounded,
                    color: l.isStory ? c.red : c.blue, size: 20),
                title: Text(l.text, style: TextStyle(fontSize: 14, height: 1.4, color: c.text)),
                subtitle: l.isStory ? Text(monthTitle(song.months[l.index]), style: TextStyle(color: c.muted)) : null,
                onTap: () => mixtape.seek(l.index),
              ),
          ],
        ),
      ),
    );
  }
}
