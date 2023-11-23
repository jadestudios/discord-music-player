import axios from "axios";
import * as cheerio from "cheerio";

export class AppleTrack {
    public artist: string;
    public title: string;

    constructor(artist: string, title: string) {
        this.artist = artist;
        this.title = title;
    }
}

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

function linkType(url: string) {
    if (RegExp(/https?:\/\/music\.apple\.com\/.+?\/album\/.+?\/.+?\?i=([0-9]+)/).test(url)) return "song";
    return 'album'
}

/**
 * Expects a valid apple url
 * @param url 
 */
export async function getApple(url: string): Promise<AppleTrack | AppleTrackList | undefined> {
    const lt = linkType(url);
    const page = await axios.get(url).then((res) => res.data).catch(() => undefined)
    if (!page) return undefined;
    const $ = cheerio.load(page);
    const scripts = $("script").toArray();
    let script_data = Object();
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
    for (let i = 0; i < script_data[0]['data']['sections'].length; i++) {
        const sections = script_data[0]['data']['sections'][i];
        if (sections['id'].includes('track-list - ')) {
            sections['items'].forEach((items: appleTrack) => {
                trackList.addTrack(new AppleTrack(items['artistName'], items['title']))
            });
        }
    }
    if (trackList.trackCount > 0) {
        if (lt == 'song') return trackList.tracks[0]
        if (lt == 'album') return trackList
    }
    return undefined
}

interface children {
    data: string
}

interface appleTrack {
    artistName: string;
    title: string;
}