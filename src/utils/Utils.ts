import {
    DefaultPlaylistOptions,
    DefaultPlayOptions,
    DMPErrors,
    Playlist,
    PlaylistOptions,
    PlayOptions,
    Queue,
    RawPlaylist,
    RawSong,
    Song,
} from "..";
import fetch from 'isomorphic-unfetch';
import YTSR, { Video } from 'ytsr';
import { getApple, AppleTrack, AppleTrackList, AppleLinkType } from "./MD_Apple";
import { Client, Playlist as IPlaylist, Video as IVideo, PlaylistVideos, VideoCompact } from "youtubei";
import { ChannelType, GuildChannel } from "discord.js";

let YouTube = new Client();
const { getData, getPreview } = require('spotify-url-info')(fetch)

export enum ProviderList {
    YOUTUBE,
    SPOTIFY,
    APPLE,
    NONE
}

export class Utils {
    static regexList = {
        YouTubeVideo: /^((?:https?:)\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))((?!channel)(?!user)\/(?:[\w\-]+\?v=|embed\/|v\/)?)((?!channel)(?!user)[\w\-]+)/,
        YouTubeVideoTime: /(([?]|[&])t=(\d+))/,
        YouTubeVideoID: /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/,
        YouTubePlaylist: /^((?:https?:)\/\/)?((?:www|m)\.)?((?:youtube\.com)).*(youtu.be\/|list=)([^#&?]*).*/,
        YouTubePlaylistID: /[&?]list=([^&]+)/,
        Spotify: /https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:track\/|\?uri=spotify:track:)((\w|-)+)(?:(?=\?)(?:[?&]foo=(\d*)(?=[&#]|$)|(?![?&]foo=)[^#])+)?(?=#|$)/,
        SpotifyPlaylist: /https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:(album|playlist)\/|\?uri=spotify:playlist:)((\w|-)+)(?:(?=\?)(?:[?&]foo=(\d*)(?=[&#]|$)|(?![?&]foo=)[^#])+)?(?=#|$)/,
        Apple: /https?:\/\/music\.apple\.com\/[a-z]{2}\/album\/[\S]+?\/\d+?\?i=([0-9]+)/,
        ApplePlaylist: /https?:\/\/music\.apple\.com\/[a-z]{2}\/(playlist|album)\//,
    }

    /**
     * Checks if url is valid and gets which provider it is 
     * @param url 
     * @returns {boolean, ProviderList}
     */
    static isSongLink(url: string): [boolean, ProviderList] {
        if (this.regexList.Spotify.test(url)) return [true, ProviderList.SPOTIFY]
        if (this.regexList.YouTubeVideo.test(url)) return [true, ProviderList.YOUTUBE]
        if (this.regexList.Apple.test(url)) return [true, ProviderList.APPLE]
        return [false, ProviderList.NONE]
    }

    static isListLink(url: string): [boolean, ProviderList] {
        if (this.regexList.SpotifyPlaylist.test(url)) return [true, ProviderList.SPOTIFY]
        if (this.regexList.YouTubePlaylist.test(url)) return [true, ProviderList.YOUTUBE]
        if (this.regexList.ApplePlaylist.test(url)) return [true, ProviderList.APPLE]
        return [false, ProviderList.NONE]
    }

    /**
     * Get ID from YouTube link
     * @param {string} url
     * @returns {?string}
     */
    static parseVideo(url: string): string | null {
        const match = url.match(this.regexList.YouTubeVideoID);
        return match ? match[7] : null;
    }

    /**
     * Get timecode from YouTube link
     * @param {string} url
     * @returns {?string}
     */
    static parseVideoTimecode(url: string): string | null {
        const match = url.match(this.regexList.YouTubeVideoTime);
        return match ? match[3] : null;
    }

    /**
     * Get ID from Playlist link
     * @param {string} url
     * @returns {?string}
     */
    static parsePlaylist(url: string): string | null {
        const match = url.match(this.regexList.YouTubePlaylistID);
        return match ? match[1] : null;
    }

    /**
     * Search for Songs
     * @param {string} Search
     * @param {PlayOptions} [SOptions=DefaultPlayOptions]
     * @param {Queue} Queue
     * @param {number} [Limit=1]
     * @return {Promise<Song[]>}
     */
    static async search(Search: string, SOptions: PlayOptions = DefaultPlayOptions, Queue: Queue, Limit: number = 5): Promise<Song[]> {
        SOptions = Object.assign({}, DefaultPlayOptions, SOptions);
        let Filters;

        try {
            // Default Options - Type: Video
            let FiltersTypes = await YTSR.getFilters(Search);
            Filters = FiltersTypes.get('Type')!.get('Video')!;

            // Custom Options - Upload date: null
            if (SOptions?.uploadDate !== null)
                Filters = Array.from(
                    (
                        await YTSR.getFilters(Filters.url!)
                    )
                        .get('Upload date')!, ([name, value]) => ({ name, url: value.url })
                )
                    .find(o => o.name.toLowerCase().includes(SOptions?.uploadDate!))
                    ?? Filters;

            // Custom Options - Duration: null
            if (SOptions?.duration !== null)
                Filters = Array.from(
                    (
                        await YTSR.getFilters(Filters.url!)
                    )
                        .get('Duration')!, ([name, value]) => ({ name, url: value.url })
                )
                    .find(o => o.name.toLowerCase().startsWith(SOptions?.duration!))
                    ?? Filters;

            // Custom Options - Sort by: relevance
            if (SOptions?.sortBy !== null && SOptions?.sortBy !== 'relevance')
                Filters = Array.from(
                    (
                        await YTSR.getFilters(Filters.url!)
                    )
                        .get('Sort by')!, ([name, value]) => ({ name, url: value.url })
                )
                    .find(o => o.name.toLowerCase().includes(SOptions?.sortBy!))
                    ?? Filters;

            let Result = await YTSR(
                Filters.url!,
                {
                    limit: Limit,
                }
            );

            let items = Result.items as Video[];

            let songs: (Song | null)[] = items.map(item => {
                if (item?.type?.toLowerCase() !== 'video')
                    return null;
                return new Song({
                    name: item.title,
                    url: item.url,
                    duration: item.duration,
                    author: item.author!.name,
                    isLive: item.isLive,
                    thumbnail: item.bestThumbnail.url!,
                } as RawSong, Queue, SOptions.requestedBy);
            }).filter(I => I);

            return songs as Song[];
        } catch (e) {
            throw DMPErrors.SEARCH_NULL;
        }
    }

    /**
     * Search for Song via link
     * @param {string} Search
     * @param {PlayOptions} SOptions
     * @param {Queue} Queue
     * @return {Promise<Song>}
     */
    static async link(Search: string, SOptions: PlayOptions = DefaultPlayOptions, Queue: Queue) {

        const [isSong, provider] = this.isSongLink(Search)
        if (!isSong) return null

        switch (provider) {
            case ProviderList.APPLE:
                try {
                    let AppleResult = await getApple(Search, AppleLinkType.Song);
                    if (AppleResult) {
                        if (AppleResult instanceof AppleTrack) {
                            let SearchResult = await this.search(
                                `${AppleResult.artist} - ${AppleResult.title}`,
                                SOptions,
                                Queue
                            );
                            return SearchResult[0];
                        }
                    }
                } catch (e) {
                    throw DMPErrors.INVALID_APPLE;
                }
                break;

            case ProviderList.SPOTIFY:
                try {
                    let SpotifyResult = await getPreview(Search);
                    let SearchResult = await this.search(
                        `${SpotifyResult.artist} - ${SpotifyResult.title}`,
                        SOptions,
                        Queue
                    );
                    return SearchResult[0];
                } catch (e) {
                    throw DMPErrors.INVALID_SPOTIFY;
                }
                break;

            case ProviderList.YOUTUBE:
                let VideoID = this.parseVideo(Search);
                if (!VideoID) throw DMPErrors.SEARCH_NULL;
                YouTube = new Client();
                let VideoResult = await YouTube.getVideo(VideoID) as IVideo;
                if (!VideoResult) throw DMPErrors.SEARCH_NULL;
                let VideoTimecode = this.parseVideoTimecode(Search);

                return new Song({
                    name: VideoResult.title,
                    url: Search,
                    duration: this.msToTime((VideoResult.duration ?? 0) * 1000),
                    author: VideoResult.channel.name,
                    isLive: VideoResult.isLiveContent,
                    thumbnail: VideoResult.thumbnails.best,
                    seekTime: SOptions.timecode && VideoTimecode ? Number(VideoTimecode) * 1000 : null,
                } as RawSong, Queue, SOptions.requestedBy);
                break;

            default:
                return null
        }
    }

    /**
     * Gets the best result of a Search
     * @param {Song|string} Search
     * @param {PlayOptions} SOptions
     * @param {Queue} Queue
     * @return {Promise<Song>}
     */
    static async best(Search: Song | string, SOptions: PlayOptions = DefaultPlayOptions, Queue: Queue): Promise<Song> {
        let _Song;

        if (Search instanceof Song)
            return Search as Song;

        _Song = await this.link(
            Search,
            SOptions,
            Queue
        );

        if (!_Song) {
            const _Song_Array = (await this.search(Search, SOptions, Queue));
            let i = 0;
            _Song = _Song_Array[i];

            while (!_Song && i < _Song_Array.length) { //Makes sure that a valid song is chosen from first 3 results
                i++;
                _Song = _Song_Array[i];
            }
        }

        return _Song; //Possibly undefined still
    }

    /**
     * Search for Playlist
     * @param {string} Search
     * @param {PlaylistOptions} SOptions
     * @param {Queue} Queue
     * @return {Promise<Playlist>}
     */
    static async playlist(Search: Playlist | string, SOptions: PlaylistOptions & { data?: any } = DefaultPlaylistOptions, Queue: Queue): Promise<Playlist> {
        if (Search instanceof Playlist)
            return Search as Playlist;

        let Limit = SOptions.maxSongs ?? -1;
        const [isList, Provider] = this.isListLink(Search);
        if (!isList) throw DMPErrors.INVALID_PLAYLIST;

        switch (Provider) {
            case ProviderList.APPLE:
                let AppleResultData = await getApple(Search, AppleLinkType.Album).catch(() => null);
                if (!AppleResultData)
                    throw DMPErrors.INVALID_PLAYLIST;
                if (!(AppleResultData instanceof AppleTrackList))
                    throw DMPErrors.INVALID_PLAYLIST;

                let AppleResult: RawPlaylist = {
                    name: 'Apple Playlist',
                    author: 'N/A',
                    url: Search,
                    songs: [],
                    type: 'playlist'
                }

                AppleResult.songs = (
                    await Promise.all(
                        AppleResultData.tracks.map(async (track, index) => {
                            if (Limit !== -1 && index >= Limit)
                                return null;
                            const Result = await this.search(
                                `${track.artist} - ${track.title}`,
                                SOptions,
                                Queue
                            ).catch(() => null);
                            if (Result && Result[0]) {
                                Result[0].data = SOptions.data;
                                return Result[0];
                            } else return null;
                        })
                    )
                )
                    .filter((V): V is Song => V !== null);

                if (AppleResult.songs.length === 0)
                    throw DMPErrors.INVALID_PLAYLIST;

                if (SOptions.shuffle)
                    AppleResult.songs = this.shuffle(AppleResult.songs);

                return new Playlist(AppleResult, Queue, SOptions.requestedBy);
                break;

            case ProviderList.SPOTIFY:
                let SpotifyResultData = await getData(Search).catch(() => null);
                if (!SpotifyResultData || !['playlist', 'album'].includes(SpotifyResultData.type))
                    throw DMPErrors.INVALID_PLAYLIST;

                let SpotifyResult: RawPlaylist = {
                    name: SpotifyResultData.name,
                    author: SpotifyResultData.subtitle,
                    url: Search,
                    songs: [],
                    type: SpotifyResultData.type
                }

                SpotifyResult.songs = (
                    await Promise.all(
                        SpotifyResultData.trackList.map(async (track: any, index: number) => {
                            if (Limit !== -1 && index >= Limit)
                                return null;
                            const Result = await this.search(
                                `${track.subtitle} - ${track.title}`,
                                SOptions,
                                Queue
                            ).catch(() => null);
                            if (Result && Result[0]) {
                                Result[0].data = SOptions.data;
                                return Result[0];
                            } else return null;
                        })
                    )
                )
                    .filter((V): V is Song => V !== null);

                if (SpotifyResult.songs.length === 0)
                    throw DMPErrors.INVALID_PLAYLIST;

                if (SOptions.shuffle)
                    SpotifyResult.songs = this.shuffle(SpotifyResult.songs);

                return new Playlist(SpotifyResult, Queue, SOptions.requestedBy);
                break;

            case ProviderList.YOUTUBE:
                let PlaylistID = this.parsePlaylist(Search);
                if (!PlaylistID)
                    throw DMPErrors.INVALID_PLAYLIST;

                YouTube = new Client();
                let YouTubeResultData = await YouTube.getPlaylist(PlaylistID);
                if (!YouTubeResultData || Object.keys(YouTubeResultData).length === 0)
                    throw DMPErrors.INVALID_PLAYLIST;

                let YouTubeResult: RawPlaylist = {
                    name: YouTubeResultData.title,
                    author: YouTubeResultData instanceof IPlaylist ? YouTubeResultData.channel?.name ?? 'YouTube Mix' : 'YouTube Mix',
                    url: Search,
                    songs: [],
                    type: 'playlist'
                }

                if (YouTubeResultData instanceof IPlaylist && YouTubeResultData.videoCount > 100 && (Limit === -1 || Limit > 100))
                    await YouTubeResultData.videos.next(Math.floor((Limit === -1 || Limit > YouTubeResultData.videoCount ? YouTubeResultData.videoCount : Limit - 1) / 100));

                if (YouTubeResultData.videos instanceof PlaylistVideos) {
                    //Needs VideoCompact[] for map to work below
                    YouTubeResultData.videos = YouTubeResultData.videos.items
                }

                YouTubeResult.songs = YouTubeResultData.videos.map((video: VideoCompact, index: number) => {
                    if (Limit !== -1 && index >= Limit)
                        return null;
                    let song = new Song({
                        name: video.title,
                        url: `https://youtube.com/watch?v=${video.id}`,
                        duration: this.msToTime((video.duration ?? 0) * 1000),
                        author: video.channel!.name,
                        isLive: video.isLive,
                        thumbnail: video.thumbnails.best!,
                    }, Queue, SOptions.requestedBy);
                    song.data = SOptions.data;
                    return song;
                })
                    .filter((V: Song | null): V is Song => V !== null);

                if (YouTubeResult.songs.length === 0)
                    throw DMPErrors.INVALID_PLAYLIST;

                if (SOptions.shuffle)
                    YouTubeResult.songs = this.shuffle(YouTubeResult.songs);

                return new Playlist(YouTubeResult, Queue, SOptions.requestedBy);
                break;

            default:
                throw DMPErrors.INVALID_PLAYLIST;
        }
    }

    /**
     * Shuffles an array
     * @param {any[]} array
     * @returns {any[]}
     */
    static shuffle(array: any[]): any[] {
        if (!Array.isArray(array))
            return [];
        const clone = [...array];
        const shuffled = [];
        while (clone.length > 0)
            shuffled.push(
                clone.splice(
                    Math.floor(
                        Math.random() * clone.length
                    ), 1
                )[0]
            );
        return shuffled;
    }

    /**
     * Converts milliseconds to duration (HH:MM:SS)
     * @returns {string}
     */
    static msToTime(duration: number): string {
        const seconds = Math.floor(duration / 1000 % 60);
        const minutes = Math.floor(duration / 60000 % 60);
        const hours = Math.floor(duration / 3600000);
        const secondsPad = `${seconds}`.padStart(2, '0');
        const minutesPad = `${minutes}`.padStart(2, '0');
        const hoursPad = `${hours}`.padStart(2, '0');

        return `${hours ? `${hoursPad}:` : ''}${minutesPad}:${secondsPad}`;
    }

    /**
     * Converts duration (HH:MM:SS) to milliseconds
     * @returns {number}
     */
    static timeToMs(duration: string): number {
        return duration.split(':')
            .reduceRight(
                (prev, curr, i, arr) => prev + parseInt(curr) * 60 ** (arr.length - 1 - i), 0
            ) * 1000;
    }

    static isVoiceChannel(Channel: GuildChannel): boolean {
        let type = Channel.type as ChannelType | string;
        if (typeof type === 'string')
            return ['GUILD_VOICE', 'GUILD_STAGE_VOICE'].includes(type);
        else return [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(type);
    }

    static isStageVoiceChannel(Channel: GuildChannel): boolean {
        let type = Channel.type as ChannelType | string;
        if (typeof type === 'string')
            return type === 'GUILD_STAGE_VOICE';
        else return type === ChannelType.GuildStageVoice;
    }

}
