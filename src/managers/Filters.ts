/**
 * From Discord-Player, changed for DMP usage
 */
import { FFmpeg } from "prism-media";
import type { Readable } from "stream";
import { Filter, StreamFiltersName } from "../types/types";

export interface FFmpegStreamOptions {
    encoderArgs?: [Filter];
    seek?: number;
}

export function FFMPEG_ARGS_STRING():string[] {
    return [
        '-analyzeduration', '0',
        '-loglevel', '0',
        '-acodec','libopus',
        '-f','opus',
        '-ar', '48000',
        '-ac', '2',
    ];
}

/**
 * Creates FFmpeg stream
 * @param stream The source stream
 * @param options FFmpeg stream options
 * @returns stream
 */
export function createFFmpegStream(stream: Readable, options?: FFmpegStreamOptions): FFmpeg {
    options ??= {};
    const args = FFMPEG_ARGS_STRING();

    if (options.seek) args.unshift("-ss", String(options.seek));
    if (Array.isArray(options.encoderArgs)){
        options.encoderArgs.unshift("-af");
        args.unshift(...options.encoderArgs);
    } 
    const transcoder = new FFmpeg({ args: args });
    transcoder.on("close", () => transcoder.destroy());
    stream.on("error", () => transcoder.destroy());
    //@ts-ignore :: Transcoder is pipeable, but is not 1:1 with WriteableStream
    stream.pipe(transcoder); 
    return transcoder;
}

export const StreamFilters: Record<StreamFiltersName, Filter> = {
    bassboost_low : "bass=g=15:f=110:w=0.3",
    bassboost : "bass=g=20:f=110:w=0.3",
    bassboost_high : "bass=g=30:f=110:w=0.3",
    "8D" : "apulsator=hz=0.09",
    vaporwave : "aresample=48000,asetrate=48000*0.8",
    nightcore : "aresample=48000,asetrate=48000*1.25",
    phaser : "aphaser=in_gain=0.4",
    tremolo : "tremolo",
    vibrato : "vibrato=f=6.5",
    reverse : "areverse",
    treble : "treble=g=5",
    normalizer2 : "dynaudnorm=g=101",
    normalizer : "acompressor",
    surrounding : "surround",
    pulsator : "apulsator=hz=1",
    subboost : "asubboost",
    karaoke : "stereotools=mlev=0.1",
    flanger : "flanger",
    gate : "agate",
    haas : "haas",
    mcompand : "mcompand",
    mono : "pan=mono|c0=.5*c0+.5*c1",
    mstlr : "stereotools=mode=ms>lr",
    mstrr : "stereotools=mode=ms>rr",
    compressor : "compand=points=-80/-105|-62/-80|-15.4/-15.4|0/-12|20/-7.6",
    expander : "compand=attacks=0:points=-80/-169|-54/-80|-49.5/-64.6|-41.1/-41.1|-25.8/-15|-10.8/-4.5|0/0|20/8.3",
    softlimiter : "compand=attacks=0:points=-80/-80|-12.4/-12.4|-6/-8|0/-6.8|20/-2.8",
    chorus : "chorus=0.7:0.9:55:0.4:0.25:2",
    chorus2d : "chorus=0.6:0.9:50|60:0.4|0.32:0.25|0.4:2|1.3",
    chorus3d : "chorus=0.5:0.9:50|60|40:0.4|0.32|0.3:0.25|0.4|0.3:2|2.3|1.3",
    fadein : "afade=t=in:ss=0:d=10",
    dim : `afftfilt="'real=re * (1-clip((b/nb)*b,0,1))':imag='im * (1-clip((b/nb)*b,0,1))'"`,
    earrape : "channelsplit,sidechaingate=level_in=64",
    echo : "aecho=0.8:0.9:1000:0.3",
    lowpass : "lowpass",
    highpass : "highpass"
}