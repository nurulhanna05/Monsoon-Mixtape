// Plain data classes for the /song response and the city list.

class Town {
  const Town(this.name, this.state, this.lat, this.lon);

  factory Town.fromJson(Map<String, dynamic> j) =>
      Town(j['name'], j['state'], (j['lat'] as num).toDouble(), (j['lon'] as num).toDouble());

  final String name;
  final String state;
  final double lat;
  final double lon;
}

class Month {
  Month.fromJson(Map<String, dynamic> j)
      : year = j['year'],
        month = j['month'],
        season = j['season'],
        temp = (j['temp'] as num).toDouble(),
        rain = (j['rain'] as num).toDouble(),
        humidity = (j['humidity'] as num).toDouble(),
        aod = (j['aod'] as num).toDouble(),
        flags = List<String>.from(j['flags']);

  final int year;
  final int month;
  final String season;
  final double temp; // °C
  final double rain; // mm/day
  final double humidity; // %
  final double aod; // haze (aerosol optical depth)
  final List<String> flags; // wet, dry, hot, cool, humid, windy, hazy
}

class Line {
  Line.fromJson(Map<String, dynamic> j)
      : index = j['month_index'],
        kind = j['kind'],
        text = j['text'];

  final int index; // month this line is spoken at
  final String kind; // intro, summary, or an anomaly kind
  final String text;

  bool get isStory => kind != 'intro' && kind != 'summary';
}

class Song {
  Song.fromJson(Map<String, dynamic> j, this.raw)
      : place = j['region']['name'],
        lead = j['region']['lead_instrument'],
        start = j['start'],
        end = j['end'],
        fromCache = j['from_cache'] == true,
        months = [for (final m in j['months']) Month.fromJson(m)],
        lines = [for (final l in j['narration']) Line.fromJson(l)],
        tempChange = (j['trend']['temp_change'] as num).toDouble(),
        hottestYear = j['trend']['hottest_year'],
        wettestYear = j['trend']['wettest_year'],
        unusualCount = (j['anomalies'] as List).length;

  final String raw; // the original JSON, handed to the sound engine
  final String place;
  final String lead; // gamelan, sape or rebab
  final int start;
  final int end;
  final bool fromCache;
  final List<Month> months;
  final List<Line> lines;
  final double tempChange; // °C, first years vs last years
  final int hottestYear;
  final int wettestYear;
  final int unusualCount;

  List<Line> get stories => lines.where((l) => l.isStory).toList();

  // The narration line most recently reached at month [i].
  Line lineAt(int i) => lines.lastWhere((l) => l.index <= i, orElse: () => lines.first);
}

// One note on the rhythm-game highway.
class Note {
  Note.fromJson(Map<String, dynamic> j)
      : lane = j['lane'],
        kind = j['kind'],
        at = (j['at'] as num).toDouble(),
        len = (j['len'] as num? ?? 0).toDouble(),
        heat = (j['heat'] as num? ?? 0).toDouble(),
        severity = (j['severity'] as num? ?? 0).toDouble(),
        hazy = j['hazy'] == true;

  final String lane; // melody, drums, flute, gongs
  final String kind; // gem, tap, drum, hold, tick, kempul, gong
  final double at; // beats (months) from the start
  final double len; // hold notes only
  final double heat; // melody: 0 coolest to 1 hottest
  final double severity; // big gong: how unusual
  final bool hazy; // flute: muffled by haze
}
