import SwiftUI
import WidgetKit

// Reads the latest sticker the app wrote into the shared App Group container.
private let group = "group.com.camart.app"

struct Entry: TimelineEntry {
  let date: Date
  let image: UIImage?
}

struct Provider: TimelineProvider {
  func load() -> UIImage? {
    guard let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { return nil }
    return UIImage(contentsOfFile: dir.appendingPathComponent("today.png").path)
  }
  func placeholder(in context: Context) -> Entry { Entry(date: .now, image: nil) }
  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(Entry(date: .now, image: load())) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    // The app calls reloadAllTimelines() after each save; no polling needed.
    completion(Timeline(entries: [Entry(date: .now, image: load())], policy: .never))
  }
}

struct TodayView: View {
  let entry: Entry
  var body: some View {
    Group {
      if let image = entry.image {
        Image(uiImage: image).resizable().scaledToFit().padding(6)
      } else {
        Text("Stick today's\nfirst moment")
          .font(.system(size: 15, weight: .bold, design: .rounded))
          .multilineTextAlignment(.center)
          .foregroundStyle(Color(red: 0.094, green: 0.125, blue: 0.2))
      }
    }
    .containerBackground(for: .widget) { Color("$widgetBackground") }
  }
}

@main
struct CamArtWidgets: WidgetBundle {
  var body: some Widget {
    Widget()
  }
}

struct Widget: SwiftUI.Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CamArtToday", provider: Provider()) { TodayView(entry: $0) }
      .configurationDisplayName("Today's sticker")
      .description("Your latest CamArt sticker.")
      .supportedFamilies([.systemSmall, .systemLarge])
  }
}
