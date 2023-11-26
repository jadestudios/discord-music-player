import axios from "axios";
import * as cheerio from "cheerio";
/**
 * Written to replace apple-music-metadata
 */


export enum AppleLinkType {
    Song,
    Album
}

/**
 * Minimal class of what a track should contain
 */
export class AppleTrack {
    public artist: string;
    public title: string;

    constructor(artist: string, title: string) {
        this.artist = artist;
        this.title = title;
    }
}

/**
 * Minimal class of what a Playlist should contain
 */
export class AppleTrackList {
    public tracks: AppleTrack[];
    public trackCount: number;

    constructor() {
        this.tracks = [];
        this.trackCount = 0;
    }

    /**
     * addTrack
     */
    public addTrack(track: AppleTrack) {
        this.tracks.push(track)
        this.trackCount = this.tracks.length;
    }
}

/**
 * Expects a valid apple url
 * @param url 
 * @param lt: AppleLinkType from caller
 */
export async function getApple(url: string, lt: AppleLinkType): Promise<AppleTrack | AppleTrackList | undefined> {
    const page = await axios.get(url).then((res) => res.data).catch(() => undefined)
    if (!page) return undefined;
    const $ = cheerio.load(page);
    const scripts = $("script").toArray();
    let script_data = Object();
    /**
     * Finds all script tags -> finds embedded data -> parse from child
     */
    for (let index = 0; index < scripts.length; index++) {
        const script = scripts[index];
        if (script!.attribs['id'] == 'serialized-server-data') {
            const script_child = script?.children;
            for (let j = 0; j < script_child!.length; j++) {
                const t3 = script_child![j] as children
                if (typeof (t3['data']) == 'string') {
                    script_data = JSON.parse(t3['data']);
                    break;
                }
            }
            break;
        }
    }
    const trackList = new AppleTrackList();
    /**
     * From parsed JSON -> check all for track list -> create track for each track in JSON list
     */
    for (let i = 0; i < script_data[0]['data']['sections'].length; i++) {
        const sections = script_data[0]['data']['sections'][i];
        if (sections['id'].includes('track-list - ')) {
            sections['items'].forEach((items: appleTrack) => {
                trackList.addTrack(new AppleTrack(items['artistName'], items['title']))
            });
        }
    }
    if (trackList.trackCount > 0) {
        if (lt == AppleLinkType.Song) return trackList.tracks[0]
        if (lt == AppleLinkType.Album) return trackList
    }
    return undefined
}

//Interface to tell TS that children has data
interface children {
    data: string
}

interface appleTrack {
    artistName: string;
    title: string;
}