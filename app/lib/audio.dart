// Talks to window.mixtapeAudio (web/audio_bridge.js), which plays the song
// with the shared Tone.js instruments.

import 'dart:js_interop';

@JS('mixtapeAudio')
external _Bridge get _bridge;

extension type _Bridge._(JSObject _) implements JSObject {
  external JSPromise<JSAny?> prepare();
  external void setHandlers(JSFunction onBeat, JSFunction onHit, JSFunction onEnd);
  external JSPromise<JSNumber> load(String json);
  external JSPromise<JSAny?> play();
  external void pause();
  external void stop();
  external void seek(int index);
  external void setTempo(double factor);
  external void setVolume(double percent);
  external void setLayer(String layer, bool on);
}

class Audio {
  Audio({
    required void Function(int index) onBeat,
    required void Function(String tile, bool big) onHit,
    required void Function() onEnd,
  }) {
    _bridge.setHandlers(onBeat.toJS, onHit.toJS, onEnd.toJS);
  }

  Future<void> prepare() => _bridge.prepare().toDart;
  Future<void> load(String songJson) => _bridge.load(songJson).toDart;
  Future<void> play() => _bridge.play().toDart;
  void pause() => _bridge.pause();
  void stop() => _bridge.stop();
  void seek(int index) => _bridge.seek(index);
  void setTempo(double factor) => _bridge.setTempo(factor);
  void setVolume(double percent) => _bridge.setVolume(percent);
  void setLayer(String layer, bool on) => _bridge.setLayer(layer, on);
}
