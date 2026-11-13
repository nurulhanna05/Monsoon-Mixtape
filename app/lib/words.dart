// Everyday words for the numbers, so nobody needs to know what 0.48 AOD is.

import 'models.dart';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

const seasonNames = {
  'northeast_monsoon': 'Northeast monsoon · wet season',
  'southwest_monsoon': 'Southwest monsoon · drier season',
  'inter_monsoon': 'Between monsoons',
};

const leadNames = {
  'gamelan': 'gamelan',
  'sape': 'sape (Sarawak lute)',
  'rebab': 'rebab (bowed fiddle)',
};

const flagNames = {
  'wet': 'Very wet', 'dry': 'Very dry', 'hot': 'Unusually hot', 'cool': 'Unusually cool',
  'humid': 'Very humid', 'windy': 'Windy', 'hazy': 'Hazy',
};

String monthTitle(Month m) => '${monthNames[m.month - 1]} ${m.year}';

// Where a value sits among all 20 years for this place: 0 low, 1 middle, 2 high.
int _third(List<double> all, double v) {
  final sorted = [...all]..sort();
  final rank = sorted.indexOf(v) / (sorted.length - 1);
  return rank < 1 / 3 ? 0 : (rank < 2 / 3 ? 1 : 2);
}

String tempWord(Song s, Month m) {
  if (m.flags.contains('hot')) return 'Hotter than usual';
  if (m.flags.contains('cool')) return 'Cooler than usual';
  return ['Cooler', 'Warm', 'Hot'][_third([for (final x in s.months) x.temp], m.temp)];
}

String rainWord(Song s, Month m) {
  if (m.flags.contains('wet')) return 'Extra rainy!';
  if (m.flags.contains('dry')) return 'Extra dry!';
  return ['Drier', 'Some rain', 'Very rainy'][_third([for (final x in s.months) x.rain], m.rain)];
}

String hazeWord(Song s, Month m) {
  if (m.flags.contains('hazy')) return 'Hazy!';
  return ['Clear air', 'A little hazy', 'Hazier'][_third([for (final x in s.months) x.aod], m.aod)];
}

String humidityWord(Song s, Month m) {
  if (m.flags.contains('humid')) return 'Extra sticky!';
  return ['Less humid', 'Humid', 'Very humid'][_third([for (final x in s.months) x.humidity], m.humidity)];
}

String gongWord(Month m) =>
    m.flags.isEmpty ? 'A normal month' : m.flags.map((f) => flagNames[f] ?? f).join(' · ');
