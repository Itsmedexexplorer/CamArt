Pod::Spec.new do |s|
  s.name           = 'CamartNative'
  s.version        = '0.1.0'
  s.summary        = 'CamArt native bits'
  s.description    = 'Subject lift, WhatsApp sticker packs, widget refresh'
  s.license        = 'MIT'
  s.author         = 'CamArt'
  s.homepage       = 'https://camart.app'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision', 'CoreImage', 'WidgetKit'
  s.source_files   = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
