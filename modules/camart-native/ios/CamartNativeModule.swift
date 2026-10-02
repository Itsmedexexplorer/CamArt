import CoreImage
import ExpoModulesCore
import UIKit
import Vision
import WidgetKit

let appGroup = "group.com.camart.app"

public class CamartNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CamartNative")

    Constant("appGroup") { appGroup }

    AsyncFunction("removeBackground") { (uri: String) throws -> String in
      guard #available(iOS 17.0, *) else { throw Failure("Lifting a subject needs iOS 17 or later") }
      guard let url = URL(string: uri), let image = UIImage(contentsOfFile: url.path), let cg = image.cgImage else {
        throw Failure("Could not read the photo")
      }
      let handler = VNImageRequestHandler(cgImage: cg, orientation: CGImagePropertyOrientation(image.imageOrientation))
      let request = VNGenerateForegroundInstanceMaskRequest()
      try handler.perform([request])
      guard let result = request.results?.first, !result.allInstances.isEmpty else { throw Failure("No subject found in this photo") }
      let buffer = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: false)
      let ci = CIImage(cvPixelBuffer: buffer)
      guard let out = CIContext().createCGImage(ci, from: ci.extent), let png = UIImage(cgImage: out).pngData() else {
        throw Failure("Could not export the lifted subject")
      }
      let file = FileManager.default.temporaryDirectory.appendingPathComponent("lift-\(Int(Date().timeIntervalSince1970 * 1000)).png")
      try png.write(to: file)
      return file.absoluteString
    }

    AsyncFunction("sendWhatsAppPack") { (json: String) throws in
      // WhatsApp's iOS contract: pack JSON on the pasteboard under this type, then open whatsapp://stickerPack.
      guard let data = json.data(using: .utf8), let link = URL(string: "whatsapp://stickerPack") else { throw Failure("Bad pack") }
      guard UIApplication.shared.canOpenURL(link) else { throw Failure("WhatsApp is not installed") }
      UIPasteboard.general.setItems(
        [["net.whatsapp.third-party.sticker-pack": data]],
        options: [.localOnly: true, .expirationDate: Date(timeIntervalSinceNow: 60)]
      )
      UIApplication.shared.open(link)
    }.runOnQueue(.main)

    Function("reloadWidgets") {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}

struct Failure: Error, LocalizedError {
  let message: String
  init(_ message: String) { self.message = message }
  var errorDescription: String? { message }
}

extension CGImagePropertyOrientation {
  init(_ o: UIImage.Orientation) {
    switch o {
    case .up: self = .up
    case .down: self = .down
    case .left: self = .left
    case .right: self = .right
    case .upMirrored: self = .upMirrored
    case .downMirrored: self = .downMirrored
    case .leftMirrored: self = .leftMirrored
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
