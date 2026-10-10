// Encodes the clip's frames to H.264 with macOS's own AVFoundation (ROADMAP 5.5b).
//
//   swift lab/video/screen/encode.swift <frames dir> <out.mp4> [fps]
//
// Instead of ffmpeg (Julian, 2026-10-09: „brich ffmpeg ab und mache es mit
// avf"): Homebrew has no bottles for macOS 13 and built ffmpeg from source
// for well over ten minutes. AVAssetWriter needs nothing installed.
import AVFoundation
import CoreGraphics
import Foundation
import ImageIO

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("usage: encode.swift <frames dir> <out.mp4> [fps]\n".data(using: .utf8)!)
    exit(2)
}
let dir = URL(fileURLWithPath: args[1])
let out = URL(fileURLWithPath: args[2])
let fps = Int32(args.count > 3 ? Int(args[3]) ?? 30 : 30)

let files = try FileManager.default.contentsOfDirectory(atPath: dir.path)
    .filter { $0.hasSuffix(".jpg") }
    .sorted()
guard let first = files.first,
      let firstSrc = CGImageSourceCreateWithURL(dir.appendingPathComponent(first) as CFURL, nil),
      let firstImage = CGImageSourceCreateImageAtIndex(firstSrc, 0, nil) else {
    FileHandle.standardError.write("no frames in \(dir.path)\n".data(using: .utf8)!)
    exit(1)
}
let width = firstImage.width, height = firstImage.height

try? FileManager.default.removeItem(at: out)
let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
let compression: [String: Any] = [
    AVVideoAverageBitRateKey: 10_000_000,
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoMaxKeyFrameIntervalKey: Int(fps) * 2,
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: compression,
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
])
writer.add(input)
writer.movieFragmentInterval = .invalid
writer.shouldOptimizeForNetworkUse = true
writer.startWriting()
writer.startSession(atSourceTime: .zero)

for (i, name) in files.enumerated() {
    guard let src = CGImageSourceCreateWithURL(dir.appendingPathComponent(name) as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(src, 0, nil),
          let pool = adaptor.pixelBufferPool else { fatalError("cannot read \(name)") }
    var buffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
    guard let pixels = buffer else { fatalError("no pixel buffer") }
    CVPixelBufferLockBaseAddress(pixels, [])
    let ctx = CGContext(
        data: CVPixelBufferGetBaseAddress(pixels), width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(pixels), space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    CVPixelBufferUnlockBaseAddress(pixels, [])
    while !input.isReadyForMoreMediaData { usleep(2000) }
    adaptor.append(pixels, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed {
    FileHandle.standardError.write("failed: \(String(describing: writer.error))\n".data(using: .utf8)!)
    exit(1)
}
print("\(files.count) frames, \(width)x\(height), \(fps) fps -> \(out.path)")
