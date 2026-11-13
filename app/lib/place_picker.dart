// Step 1: pick a place. A search box, a few favourite cities, "Surprise me"
// and a map you can tap anywhere on.

import 'package:material_ui/material_ui.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import 'mixtape.dart';
import 'models.dart';
import 'theme.dart';

const _favourites = ['Kuala Lumpur', 'George Town', 'Kota Kinabalu', 'Kuching', 'Johor Bahru', 'Cameron Highlands'];

class PlacePicker extends StatelessWidget {
  const PlacePicker({super.key, required this.mixtape, this.onPicked, this.mapHeight});

  final Mixtape mixtape;
  final VoidCallback? onPicked;
  final double? mapHeight; // null = fill the remaining height

  void _pick(Town t) {
    mixtape.pickTown(t);
    onPicked?.call();
  }

  @override
  Widget build(BuildContext context) {
    final c = Palette.of(context);
    final map = ClipRRect(borderRadius: BorderRadius.circular(18), child: _Map(mixtape: mixtape, onPicked: onPicked));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: ListenableBuilder(
          listenable: mixtape,
          builder: (context, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const StepTitle(number: 1, text: 'Pick a place'),
              const SizedBox(height: 14),
              _Search(towns: mixtape.towns, onPick: _pick),
              const SizedBox(height: 14),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final name in _favourites)
                  if (mixtape.towns.where((t) => t.name == name).firstOrNull case final town?)
                    ChoiceChip(
                      label: Text(name),
                      selected: mixtape.pickedTown == town,
                      showCheckmark: false,
                      selectedColor: nasaBlue,
                      labelStyle: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: mixtape.pickedTown == town ? Colors.white : c.blue,
                      ),
                      onSelected: (_) => _pick(town),
                    ),
                ActionChip(
                  avatar: Icon(Icons.casino_rounded, color: c.red, size: 18),
                  label: Text('Surprise me', style: TextStyle(color: c.red, fontWeight: FontWeight.w600)),
                  onPressed: mixtape.towns.isEmpty
                      ? null
                      : () {
                          mixtape.surprise();
                          onPicked?.call();
                        },
                ),
              ]),
              const SizedBox(height: 16),
              Row(children: [
                Icon(Icons.touch_app_rounded, size: 18, color: c.muted),
                SizedBox(width: 6),
                Expanded(
                  child: Text('Or tap anywhere on the map', style: TextStyle(color: c.muted, fontSize: 14)),
                ),
              ]),
              const SizedBox(height: 8),
              if (mapHeight == null) Expanded(child: map) else SizedBox(height: mapHeight, child: map),
            ],
          ),
        ),
      ),
    );
  }
}

class StepTitle extends StatelessWidget {
  const StepTitle({super.key, required this.number, required this.text});

  final int number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      child: Row(children: [
        CircleAvatar(
          radius: 15,
          backgroundColor: nasaRed,
          child: Text('$number', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(width: 10),
        Text(text, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
      ]),
    );
  }
}

class _Search extends StatelessWidget {
  const _Search({required this.towns, required this.onPick});

  final List<Town> towns;
  final void Function(Town) onPick;

  @override
  Widget build(BuildContext context) {
    final c = Palette.of(context);
    return Autocomplete<Town>(
      displayStringForOption: (t) => t.name,
      optionsBuilder: (value) {
        final q = value.text.trim().toLowerCase();
        if (q.isEmpty) return const [];
        return towns.where((t) => t.name.toLowerCase().contains(q) || t.state.toLowerCase().contains(q));
      },
      onSelected: (t) {
        FocusManager.instance.primaryFocus?.unfocus();
        onPick(t);
      },
      fieldViewBuilder: (context, controller, focusNode, onSubmit) => TextField(
        controller: controller,
        focusNode: focusNode,
        onSubmitted: (_) => onSubmit(),
        decoration: InputDecoration(
          hintText: 'Search 37 cities, e.g. Ipoh',
          prefixIcon: Icon(Icons.search_rounded, color: c.blue),
          filled: true,
          fillColor: c.panel,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(30),
            borderSide: BorderSide(color: c.blue, width: 2),
          ),
        ),
      ),
      optionsViewBuilder: (context, onSelected, options) => Align(
        alignment: Alignment.topLeft,
        child: Material(
          elevation: 6,
          borderRadius: BorderRadius.circular(18),
          clipBehavior: Clip.antiAlias,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 280, maxWidth: 400),
            child: ListView(shrinkWrap: true, padding: EdgeInsets.zero, children: [
              for (final t in options)
                ListTile(
                  leading: Icon(Icons.place_rounded, color: c.red),
                  title: Text(t.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(t.state),
                  onTap: () => onSelected(t),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Map extends StatefulWidget {
  const _Map({required this.mixtape, this.onPicked});

  final Mixtape mixtape;
  final VoidCallback? onPicked;

  @override
  State<_Map> createState() => _MapState();
}

class _MapState extends State<_Map> {
  final controller = MapController();
  LatLng? _shown;

  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: widget.mixtape, builder: _build);

  // Rebuilds with the app state: towns and outlines arrive after the first
  // frame, and picks move the pin.
  Widget _build(BuildContext context, Widget? _) {
    final m = widget.mixtape;
    final picked = m.picked;
    final c = Palette.of(context);
    final night = Theme.of(context).brightness == Brightness.dark;
    // Glide to cities picked from the chips or the search box.
    if (picked != null && picked != _shown) {
      _shown = picked;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final zoom = controller.camera.zoom;
        controller.move(picked, zoom < 7 ? 7 : zoom);
      });
    }

    return Semantics(
      label: 'Map of Malaysia. Tap anywhere to hear that place. You can also use the search box or city buttons.',
      child: FlutterMap(
        mapController: controller,
        options: MapOptions(
          initialCameraFit: CameraFit.bounds(
            bounds: LatLngBounds(const LatLng(0.8, 99.6), const LatLng(7.4, 119.3)),
            padding: const EdgeInsets.all(8),
          ),
          minZoom: 4.5,
          maxZoom: 12,
          backgroundColor: c.tint,
          interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
          onTap: (_, point) {
            m.pick(point.latitude, point.longitude);
            widget.onPicked?.call();
          },
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'org.spaceapps.monsoon_mixtape',
            tileBuilder: night ? darkModeTileBuilder : null,
          ),
          PolygonLayer(polygons: [
            for (final ring in m.stateOutlines)
              Polygon(
                points: ring,
                color: c.blue.withValues(alpha: 0.08),
                borderColor: c.blue.withValues(alpha: 0.6),
                borderStrokeWidth: 1,
              ),
          ]),
          MarkerLayer(markers: [
            for (final t in m.towns)
              Marker(
                point: LatLng(t.lat, t.lon),
                width: 28,
                height: 28,
                child: Tooltip(
                  message: '${t.name}, ${t.state}',
                  child: GestureDetector(
                    onTap: () {
                      m.pickTown(t);
                      widget.onPicked?.call();
                    },
                    child: MouseRegion(
                      cursor: SystemMouseCursors.click,
                      child: Center(
                        child: Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            color: nasaBlue,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2.5),
                            boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 3)],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            if (picked != null)
              Marker(
                point: picked,
                width: 44,
                height: 44,
                alignment: Alignment.topCenter,
                child: const Icon(Icons.location_on_rounded, color: nasaRed, size: 44,
                    shadows: [Shadow(color: Colors.black38, blurRadius: 6)]),
              ),
          ]),
          SimpleAttributionWidget(
            source: Text('OpenStreetMap contributors', style: TextStyle(color: c.text)),
            backgroundColor: c.card.withValues(alpha: 0.85),
          ),
        ],
      ),
    );
  }
}
