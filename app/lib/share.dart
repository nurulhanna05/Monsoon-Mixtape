// The QR code in the header: scan it to open this demo on a phone. It points
// at the address the server says it's published at (PUBLIC_URL, see
// deploy/README.md), or else at whatever address this page was opened on.

import 'package:material_ui/material_ui.dart';
import 'package:qr/qr.dart';

import 'theme.dart';

// Only this computer can open these, so a QR of them is no use on a phone.
bool isLocalOnly(String url) {
  final host = Uri.tryParse(url)?.host ?? '';
  return host == 'localhost' || host == '127.0.0.1' || host == '::1' || host == '[::1]';
}

class QrBox extends StatelessWidget {
  const QrBox({super.key, required this.data, required this.size});

  final String data;
  final double size;

  @override
  Widget build(BuildContext context) {
    final image = QrImage(QrCode(payload: QrPayload.fromString(data), errorCorrectLevel: QrErrorCorrectLevel.medium));
    return Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(size * 0.06), // the quiet border scanners need
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(size * 0.08)),
      child: CustomPaint(painter: _QrPainter(image)),
    );
  }
}

class _QrPainter extends CustomPainter {
  _QrPainter(this.image);

  final QrImage image;

  @override
  void paint(Canvas canvas, Size size) {
    final n = image.moduleCount;
    final cell = size.width / n;
    final ink = Paint()..color = nasaBlack;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        // A hair of overlap so no seams show between squares.
        if (image.isDark(r, c)) canvas.drawRect(Rect.fromLTWH(c * cell, r * cell, cell + 0.4, cell + 0.4), ink);
      }
    }
  }

  @override
  bool shouldRepaint(_QrPainter old) => old.image != image;
}

void showShare(BuildContext context, String url) {
  final c = Palette.of(context);
  final local = isLocalOnly(url);
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Try it on your phone'),
      content: SizedBox(
        width: 320,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Semantics(label: 'QR code for $url', child: QrBox(data: url, size: 260)),
          const SizedBox(height: 14),
          SelectableText(url, textAlign: TextAlign.center, style: TextStyle(color: c.blue, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(
            local
                ? 'This address only works on this computer. Once the app is online, this code opens it on any phone.'
                : 'Point your phone camera at the code to open Monsoon Mixtape.',
            textAlign: TextAlign.center,
            style: TextStyle(color: c.muted, height: 1.4),
          ),
        ]),
      ),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
    ),
  );
}
