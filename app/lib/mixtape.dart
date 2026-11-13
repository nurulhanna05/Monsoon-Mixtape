// App state: which place is picked, the loaded song, and what's playing.

import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import 'audio.dart';
import 'models.dart';

// The four instrument tiles plus the humidity echo.
const tiles = ['melody', 'drums', 'flute', 'gongs', 'humidity'];

class Mixtape extends ChangeNotifier {
  Mixtape() {
    audio = Audio(onBeat: _onBeat, onHit: _onHit, onEnd: _onEnd);
    audio.setVolume(volume);
  }

  late final Audio audio;
  List<Town> towns = [];
  List<List<LatLng>> stateOutlines = [];

  LatLng? picked;
  String? pickedName; // city name while loading, before the server answers
  Song? song;
  List<Note> chart = []; // notes for the rhythm-game highway
  int index = 0; // month being heard
  bool loading = false;
  bool playing = false;
  bool finished = false;
  String? error;

  bool narrator = true; // speak the narration out loud
  double tempo = 1;
  double volume = 80;
  final layerOn = {for (final t in tiles) t: true};
  // Bumped on every stroke, so tiles can bounce in time with the music.
  final hits = {for (final t in tiles) t: ValueNotifier(0)};
  bool lastGongBig = false;

  int _request = 0; // ignore slow answers for places the user has moved on from

  static Uri _url(String path, [Map<String, String>? query]) =>
      Uri.base.resolve(path).replace(queryParameters: query);

  Future<void> loadStatic() async {
    final townJson = jsonDecode((await http.get(_url('/data/towns.json'))).body) as List;
    towns = [for (final t in townJson) Town.fromJson(t)];
    notifyListeners();

    // State outlines for the map (outer rings only).
    final geo = jsonDecode((await http.get(_url('/data/malaysia_states.geojson'))).body);
    final outlines = <List<LatLng>>[];
    for (final f in geo['features']) {
      final g = f['geometry'];
      final polygons = g['type'] == 'Polygon' ? [g['coordinates']] : g['coordinates'];
      for (final p in polygons) {
        outlines.add([for (final c in p[0]) LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble())]);
      }
    }
    stateOutlines = outlines;
    notifyListeners();
  }

  Town? get pickedTown =>
      towns.where((t) => picked != null && t.lat == picked!.latitude && t.lon == picked!.longitude).firstOrNull;

  Future<void> pickTown(Town t) => pick(t.lat, t.lon, name: t.name);

  Future<void> surprise() => pickTown(towns[Random().nextInt(towns.length)]);

  // Load a place's song and start playing it.
  Future<void> pick(double lat, double lon, {String? name}) async {
    final id = ++_request;
    audio.stop();
    audio.hush();
    audio.prepare(); // start audio during the tap itself
    picked = LatLng(lat, lon);
    pickedName = name;
    song = null;
    index = 0;
    playing = false;
    finished = false;
    loading = true;
    error = null;
    notifyListeners();

    try {
      final resp = await http.get(_url('/song', {'lat': lat.toStringAsFixed(4), 'lon': lon.toStringAsFixed(4)}));
      final body = jsonDecode(resp.body);
      if (resp.statusCode != 200) throw Exception(body['detail'] ?? resp.reasonPhrase);
      final s = Song.fromJson(body, resp.body);
      final chartJson = await audio.load(s.raw);
      if (id != _request) return;
      song = s;
      chart = [for (final n in jsonDecode(chartJson)) Note.fromJson(n)];
      loading = false;
      await audio.play();
      playing = true;
    } catch (e) {
      if (id != _request) return;
      loading = false;
      error = '$e'.replaceFirst('Exception: ', '');
    }
    notifyListeners();
  }

  Future<void> togglePlay() async {
    if (song == null) {
      if (towns.isNotEmpty) await pickTown(towns.first);
      return;
    }
    if (playing) {
      audio.pause();
      audio.hush();
      playing = false;
    } else {
      if (finished) {
        audio.seek(0);
        finished = false;
      } else {
        await audio.play();
      }
      playing = true;
    }
    notifyListeners();
  }

  void restart() {
    if (song == null) return;
    seek(0);
  }

  void seek(int i) {
    if (song == null) return;
    index = i.clamp(0, song!.months.length - 1);
    audio.hush();
    audio.seek(index);
    playing = true;
    finished = false;
    notifyListeners();
  }

  // Jump to the next (or previous) story the narration tells.
  void jumpStory(int direction) {
    final stories = song?.stories ?? [];
    final next = direction > 0
        ? stories.where((l) => l.index > index).firstOrNull
        : stories.lastWhere((l) => l.index < index, orElse: () => stories.first);
    if (next != null) seek(next.index);
  }

  void setTempo(double f) {
    tempo = f;
    audio.setTempo(f);
    notifyListeners();
  }

  void setVolume(double v) {
    volume = v;
    audio.setVolume(v);
    notifyListeners();
  }

  void toggleNarrator() {
    narrator = !narrator;
    if (!narrator) audio.hush();
    notifyListeners();
  }

  void toggleLayer(String layer) {
    layerOn[layer] = !layerOn[layer]!;
    audio.setLayer(layer, layerOn[layer]!);
    notifyListeners();
  }

  void _onBeat(int i) {
    index = i;
    if (narrator) {
      for (final line in song?.lines ?? const <Line>[]) {
        if (line.index == i) audio.speak(line.text);
      }
    }
    notifyListeners();
  }

  void _onHit(String tile, bool big) {
    if (tile == 'gongs') lastGongBig = big;
    hits[tile]!.value++;
  }

  void _onEnd() {
    playing = false;
    finished = true;
    notifyListeners();
  }
}
