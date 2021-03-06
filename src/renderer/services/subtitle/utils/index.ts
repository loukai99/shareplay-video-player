import { detect } from 'chardet';
import { encodingExists, decode } from 'iconv-lite';
import {
  open, read, close, readFile, existsSync, outputFile,
} from 'fs-extra';
import uuidv4 from 'uuid/v4';
import { extname, join } from 'path';
import {
  ITags, IOrigin, Type, Format, IParser, ILoader, Cue, IVideoSegments, IMetadata, TextCue,
} from '@/interfaces/ISubtitle';
import { LanguageCode } from '@/libs/language';

import {
  AssParser, SrtParser, SagiTextParser, VttParser, ModifiedParser,
} from '@/services/subtitle';

import { SUBTITLE_FULL_DIRNAME } from '@/constants';
import { assFragmentLanguageLoader, srtFragmentLanguageLoader, vttFragmentLanguageLoader } from './languageLoader';
import {
  IEmbeddedOrigin,
  EmbeddedStreamLoader, LocalTextLoader, SagiLoader, LocalBinaryLoader, ModifiedLoader,
} from './loaders';
import { SagiImageParser } from '../parsers/sagiImage';

/**
 * TextCue tags getter for SubRip, SubStation Alpha and Online Transcript subtitles.
 *
 * @export
 * @param {string} text - cue text to evaluate.
 * @param {object} baseTags - default tags for the cue.
 * @returns {object} tags object for the cue
 */
export function tagsGetter(text: string, baseTags: ITags) {
  const tagRegex = /\{[^{}]*\}/g;
  const matchTags = text.match(tagRegex);
  const finalTags = { ...baseTags };
  if (matchTags) {
    const tagGetters = {
      an: (tag: string) => {
        const matchedAligment = tag.match(/\d/g);
        if (matchedAligment) return Number.parseFloat(matchedAligment[0]);
        return undefined;
      },
      pos: (tag: string) => {
        const matchedCoords = tag.match(/\((.*)\)/);
        if (matchedCoords) {
          const coords = matchedCoords[1].split(',');
          return ({
            pos: {
              x: Number.parseFloat(coords[0]),
              y: Number.parseFloat(coords[1]),
            },
          });
        }
        return undefined;
      },
    };
    for (let tag of matchTags) {
      tag = tag.replace(/[{}\\/]/g, '');
      Object.keys(tagGetters).forEach((getterType) => {
        if (tag.startsWith(getterType)) {
          Object.assign(finalTags, tagGetters[getterType](tag));
        }
      });
    }
  }
  return finalTags;
}

/**
 * Detect encoding from a buffer
 *
 * @export
 * @param {Buffer} buffer - buffer to detect
 * @returns invalid encoding supported both by chardet and iconv-lite
 */
export async function detectEncoding(buffer: Buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('Buffer expected.');
  const encoding = await detect(buffer);
  if (typeof encoding === 'string' && encodingExists(encoding)) return encoding;
  throw new Error(`Unsupported encoding: ${encoding}.`);
}

export async function extractTextFragment(path: string, encoding?: string) {
  try {
    const fd = await open(path, 'r');
    if (!encoding) {
      const encodingBufferSize = 4096;
      const encodingBuffer = Buffer.alloc(4096);
      await read(fd, encodingBuffer, 0, encodingBufferSize, 0);
      encoding = await detectEncoding(encodingBuffer);
    }
    if (!encodingExists(encoding)) throw new Error(`Unsupported encoding ${encoding}.`);

    const languageBufferSize = 4096 * 20;
    const languageBuffer = Buffer.alloc(languageBufferSize);
    await read(fd, languageBuffer, 0, languageBufferSize, 0);
    await close(fd);
    return decode(languageBuffer, encoding).replace(/\r?\n|\r/g, '\n');
  } catch (e) {
    return '';
  }
}

/**
 * Load string content from path
 *
 * @export
 * @param {string} path - path of a local file
 * @returns string content or err when read/decoding file
 */
export async function loadLocalFile(path: string, encoding?: string) {
  const fileBuffer = await readFile(path);
  if (encoding && encodingExists(encoding)) return decode(fileBuffer, encoding);
  const encodingBuffer = Buffer.from(fileBuffer, 4096);
  const fileEncoding = await detectEncoding(encodingBuffer);
  return decode(fileBuffer, fileEncoding);
}

export function pathToFormat(path: string): Format {
  const extension = extname(path).slice(1);
  switch (extension) {
    case 'ass':
      return Format.AdvancedSubStationAplha;
    case 'srt':
      return Format.SubRip;
    case 'ssa':
      return Format.SubStationAlpha;
    case 'vtt':
      return Format.WebVTT;
    case 'sis':
      return Format.SagiImage;
    default:
      return Format.Unknown;
  }
}

export function sourceToFormat(subtitleSource: IOrigin) {
  switch (subtitleSource.type) {
    case Type.Online:
    case Type.Translated:
    case Type.PreTranslated:
      return Format.SagiText;
    case Type.Embedded: {
      const { isImage } = (subtitleSource as IEmbeddedOrigin).source;
      if (isImage) return Format.SagiImage;
      return Format.AdvancedSubStationAplha;
    }
    default:
      return pathToFormat(subtitleSource.source as string);
  }
}

export function formatToExtension(format: Format): string {
  switch (format) {
    case Format.SagiText:
    case Format.WebVTT:
      return 'vtt';
    case Format.SubRip:
      return 'srt';
    default:
      return format;
  }
}

export async function inferLanguageFromPath(path: string): Promise<LanguageCode> {
  const format = await pathToFormat(path);
  const textFragment = await extractTextFragment(path);
  switch (format) {
    case Format.AdvancedSubStationAplha:
    case Format.SubStationAlpha:
      return assFragmentLanguageLoader(textFragment)[0];
    case Format.SubRip:
      return srtFragmentLanguageLoader(textFragment)[0];
    case Format.WebVTT:
      return vttFragmentLanguageLoader(textFragment)[0];
    default:
      throw new Error(`Unsupported format ${format}.`);
  }
}

export function getDialogues(dialogues: TextCue[], time?: number) {
  return typeof time === 'undefined' ? dialogues
    : dialogues.filter(({ start, end, text }) => (
      (start <= time && end >= time) && !!text
    ));
}

export function getLoader(source: IOrigin, format: Format): ILoader {
  switch (source.type) {
    default:
      throw new Error('Unknown source type.');
    case Type.Embedded: {
      const { videoPath, streamIndex } = (source as IEmbeddedOrigin).source;
      return new EmbeddedStreamLoader(videoPath, streamIndex, format);
    }
    case Type.Local: {
      switch (format) {
        case Format.AdvancedSubStationAplha:
        case Format.SubStationAlpha:
        case Format.SubRip:
        case Format.WebVTT:
          return new LocalTextLoader(source.source as string);
        case Format.SagiImage:
          return new LocalBinaryLoader(source.source as string);
        default:
          throw new Error(`Unknown local subtitle's format ${format}.`);
      }
    }
    case Type.Online:
      return new SagiLoader(source.source as string);
    case Type.Translated:
      return new SagiLoader(source.source as string);
    case Type.PreTranslated:
      return new SagiLoader(source.source as string);
    case Type.Modified:
      return new ModifiedLoader((source.source as { source: string }).source);
  }
}

export function getParser(
  format: Format,
  loader: ILoader,
  videoSegments: IVideoSegments,
): IParser {
  if (loader.source.type === Type.Modified) {
    return new ModifiedParser(loader as ModifiedLoader, videoSegments);
  }
  switch (format) {
    default:
      throw new Error('Unknown format');
    case Format.AdvancedSubStationAplha:
    case Format.SubStationAlpha:
      return new AssParser(loader, videoSegments);
    case Format.SagiText:
      return new SagiTextParser(loader as SagiLoader, videoSegments);
    case Format.SubRip:
      return new SrtParser(loader as LocalTextLoader, videoSegments);
    case Format.WebVTT:
      return new VttParser(loader as LocalTextLoader, videoSegments);
    case Format.DvbSub:
    case Format.HdmvPgs:
    case Format.VobSub:
      throw new Error('Local bitmap-based subtitle loading hasn\'t been implemented yet!');
    case Format.SagiImage:
      return new SagiImageParser(loader, videoSegments);
  }
}

export async function storeModified(
  dialogues: Cue[],
  meta?: IMetadata,
): Promise<{ hash: string, path: string }> {
  const result = {
    hash: '',
    path: '',
  };
  const hash = uuidv4();
  const storedPath = join(SUBTITLE_FULL_DIRNAME, `${hash}.modifed`);
  if (!existsSync(storedPath)) {
    try {
      const bin = Buffer.from(`\ufeff${JSON.stringify({ dialogues, meta })}`, 'utf8');
      await outputFile(storedPath, bin);
      result.hash = hash;
      result.path = storedPath;
    } catch (error) {
      // empty
    }
  }
  return result;
}

/**
  * @description ?????????dialogues???????????? ??????????????????????????????????????????????????????????????????
  * @author tanghaixiang@xindong.com
  * @date 2019-03-25
  * @export
  * @param {Array} dialogues ???????????????
  * @param {String} type ????????????
  */
export function generateTrack(dialogues: TextCue[]) {
  const startTrack = 1;
  let init = false;
  const store = {};
  const isOtherPos = (e: TextCue) => e.tags && (e.tags.pos || e.tags.alignment !== 2);
  const isCross = (l: TextCue, r: TextCue) => {
    const nl = l.start < r.start && l.end <= r.start;
    const rl = r.start < l.start && r.end <= l.start;
    return !(nl || rl);
  };
  // ????????????
  const compare = (i: number, j: number): TextCue => {
    const current = dialogues[i];
    const left = dialogues[j];
    if (isOtherPos(left)) {
      // ???????????????2???????????????????????????????????????????????????????????????
      return compare(i, j - 1);
    } else if (isCross(left, current)) { // eslint-disable-line
      // ???????????????????????????????????????
      current.track = left.track ? left.track + 1 : 1;
      // ???????????????????????????????????????????????????
      // ????????????????????????????????????????????????????????????????????????????????????????????????
      current.overRange = left.end > current.end;
    } else if (left.overRange) {
      // ????????????????????????????????????????????????????????????????????????
      // ?????????????????????????????????
      return compare(i, j - 1);
    } else {
      current.track = startTrack;
    }
    // ?????????????????????(????????????????????????????????????)???????????????????????????????????????
    // ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
    // ?????????
    for (let k = left.track ? j - left.track : j - 1; k > -1; k -= 1) {
      const left = dialogues[k];
      if (isCross(left, current) && !isOtherPos(left) && left.track === 1) {
        store[k] = store[k] && store[k] > current.track ? store[k] : current.track;
        break;
      }
    }
    return current;
  };
  dialogues.map((e, i) => {
    // ???????????????2?????????????????????????????????????????????????????????
    // ?????????????????????????????????????????????????????????????????????
    if (isOtherPos(e)) {
      return e;
    }
    // ????????????????????????????????????
    if (!init) {
      e.track = startTrack;
      init = true;
      return e;
    }
    return compare(i, i - 1);
  });
  // ????????????????????????????????????
  for (const i in store) {
    if (dialogues[i]) {
      let index = `${Number(i) + 1}`;
      const step = store[i];
      dialogues[i].track += step;
      // ???????????????????????????????????????????????????????????????????????????
      while (dialogues[index].track > 1) {
        dialogues[index].track += step;
        index = `${Number(index) + 1}`;
      }
    }
  }

  return dialogues;
}

/**
 * @description ????????????????????????,?????????????????????
 * @author tanghaixiang
 * @param {TextCue[]} dialogues
 * @returns {TextCue[]}
 */
export function megreSameTime(dialogues: TextCue[]): TextCue[] {
  const target = {
  };
  let text = '';
  // ???????????????????????????????????????
  const same = (l: TextCue, r: TextCue) => { // eslint-disable-line
    text = r.text;
    let samePos = false;
    const leftTags = l.tags;
    const rightTags = r.tags;
    if (leftTags && typeof leftTags === typeof rightTags) {
      // ??????????????????alignment
      const sameAlignment = leftTags.alignment === rightTags.alignment;
      if (typeof leftTags.pos === typeof rightTags.pos) {
        // ????????????????????????
        if (typeof leftTags.pos === 'undefined' || leftTags.pos === null) {
          samePos = true;
        } else if (leftTags.pos && rightTags.pos) {
          samePos = leftTags.pos.x === rightTags.pos.x && leftTags.pos.y === rightTags.pos.y;
        }
      }
      return sameAlignment && samePos;
    }
    return false;
  };
  for (let i = 0; i < dialogues.length; i += 1) {
    const key = `${dialogues[i].start}-${dialogues[i].end}`;
    if (typeof target[key] !== 'undefined') {
      if (same(dialogues[target[key]], dialogues[i]) && text !== '') {
        dialogues[target[key]].text += `<br>${text}`;
        dialogues.splice(i, 1);
        i -= 1;
      }
    } else {
      target[key] = i;
    }
  }
  return dialogues;
}

const isCross = (l: Cue, r: Cue) => {
  const nl = l.start < r.start && l.end <= r.start;
  const rl = r.start < l.start && r.end <= l.start;
  return !(nl || rl);
};

export function deleteCrossSubs(left: Cue[], right: Cue[]) {
  return left.filter((e: Cue) => !right.some((c: Cue) => isCross(c, e)));
}
