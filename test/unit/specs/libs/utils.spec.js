import { readFileSync } from 'fs';
import {
  calculateTextSize,
  generateShortCutImageBy,
  mediaQuickHash,
  timecodeFromSeconds,
  parseNameFromPath,
  crc32,
  getNumbersFromVersion,
  compareVersions,
} from '@/libs/utils';

describe('libs utils', () => {
  let fontSize = '';
  let fontFamily = '';
  let lineHeight = '';
  let zoom = '';
  let text = '';
  beforeEach(() => {
    fontSize = '12px';
    fontFamily = 'PingFang SC';
    lineHeight = '120%';
    zoom = '1';
    text = 'test for calculate text width';
  });

  it('should successfully calculate text width', () => {
    expect(JSON.stringify(calculateTextSize(fontSize, fontFamily, lineHeight, zoom, text)))
      .to.be.equal(JSON.stringify({ width: 164.281, height: 14 }));
  });

  it('should successfully generate ShortCutImage', () => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const shortCut = generateShortCutImageBy(video, canvas, 500, 500);
    const result = shortCut.shortCut.length > 0 && shortCut.smallShortCut.length > 0;
    expect(result).to.be.equal(true);
  });
  it('should return correct hash value', async () => {
    const expectedResult = '84f0e9e5e05f04b58f53e2617cc9c866-'
      + 'f54d6eb31bef84839c3ce4fc2f57991c-'
      + 'b1f0696aec64577228d93eabcc8eb69b-'
      + 'f497c6684c4c6e50d0856b5328a4bedc';
    expect(await mediaQuickHash('./test/assets/test.avi')).to.be.equal(expectedResult);
    try {
      await mediaQuickHash('./test/assets/test_not_exist.avi');
    } catch (ex) {
      expect(ex).to.be.an('error');
    }
    expect(await mediaQuickHash.try('./test/assets/test.avi')).to.be.equal(expectedResult);
    expect(await mediaQuickHash.try('./test/assets/test_not_exist.avi')).to.be.null;
  });
  describe('method - timecodeFromSeconds', () => {
    it('time < 60s', () => {
      const result = timecodeFromSeconds(59);
      expect(result).to.equal('00:59');
    });
    it('time > 60s && time < 10m', () => {
      const result = timecodeFromSeconds(590);
      expect(result).to.equal('09:50');
    });
    it('time > 10m && time < 1hour', () => {
      const result = timecodeFromSeconds(3590);
      expect(result).to.equal('59:50');
    });
    it('time > 1hour', () => {
      const result = timecodeFromSeconds(3610);
      expect(result).to.equal('1:00:10');
    });
  });

  it('should parse name correctly', () => {
    [
      '??????.S01E01.mkv',
      '??????.S1E1.x264-SVA.mp4',
      '??????.SE01EP01.3gp2',
      '??????.SE1EP1.x264-SVA,rmvb',
      '??????.??????????????????.mp4',
      '???????????????1??????1???.mp4',
      '????????????.???01??????01???.mp4',
      'Greys Anatomy - s01e01.mp4',
      'Greys Anatomy - s01e01 x264.HD.mp4',
      '7o9-ancient-aliens-s01e01-720p-bluray-x264.mkv',
    ].forEach((e) => {
      expect(JSON.stringify(parseNameFromPath(e))).to.be.equals(JSON.stringify({
        season: '01',
        episode: '01',
      }));
    });
    [
      '??????.01.h456.1080P.EP01blue.mp4',
      '??????.01.h456.1080P.EP01].mp4',
      '??????.01.h456.1080P.E01_xx.mp4',
      '??????.01.h456.1080P.E01 .xx.mp4',
      '??????.01.h456.1080P.ep01.xx.mp4',
      '??????.01.h456.1080P.E01.xx.mp4',
      '??????.01.h456.1080P.e01-.xx.mp4',
      '??????.EP01.x264-SVA.mp4',
      '?????????????????????.test.mp4',
      '????????????.???1???.mp4',
      ' ???????????????01???.mkv',
    ].forEach((e) => {
      expect(JSON.stringify(parseNameFromPath(e))).to.be.equals(JSON.stringify({
        season: null,
        episode: '01',
      }));
    });
    [
      '???????????????.Cheer.Dance.S11E12.Chi_Jap.HDTVrip.1280X720.mp4',
      '???????????????.S11E12.Chi_Jap.HDTVrip.1280X720.mp4',
      '??????.SE11EP12.se4',
      '??????.SE11EP12.mp5',
      '???????????????????????????????????????.mp4',
      '????????????.????????????????????????.3gp2',
      '???????????????11??????????????????.mp4',
      '??????????????????????????????12???.mkv',
    ].forEach((e) => {
      expect(JSON.stringify(parseNameFromPath(e))).to.be.equals(JSON.stringify({
        season: '11',
        episode: '12',
      }));
    });
    [
      'Apple Special Event. October 22, 2013..mp4',
      'cls-kungfuhubs1080dub.mp4',
      'ewdp-girlgifts720p.mp4',
      'Event.???????????????p6~p7.mkv',
      'Event.????????????.mkv',
    ].forEach((e) => {
      expect(JSON.stringify(parseNameFromPath(e))).to.be.equals(JSON.stringify({
        season: null,
        episode: null,
      }));
    });
    [
      '??????.SE01.h456.1080P.01.mp4',
      '/User/harry/??????.S08E08/??????.SE01.h456.1080P.01.mp4',
      '??????.s01.h456.1080P.01.mp4',
      '??????_sE01.h456.1080P.01.mp4',
      '??????[s01.h456.1080P.01.mp4',
      '??????-s01.h456.1080P.01.mp4',
      '?????? sE01.h456.1080P.01.mp4',
    ].forEach((e) => {
      expect(JSON.stringify(parseNameFromPath(e))).to.be.equals(JSON.stringify({
        season: '01',
        episode: null,
      }));
    });
  });

  it('should hit names percentage > 93%', () => {
    const str = readFileSync('./test/assets/names.txt', {}).toString();
    const j = {};
    let count = 0;
    const names = str.split('\n').filter((e) => {
      if (!e) return false;
      if (j[e]) return false;
      j[e] = true;
      return true;
    });
    names.forEach((e) => {
      if (parseNameFromPath(e).episode !== null) {
        count += 1;
      }
    });
    expect(count / names.length > 0.93).to.be.equals(true);
  });

  it('should compute correct result for crc32', () => {
    expect(crc32('test')).to.be.equal(-662733300);
  });

  it('should get right result for getNumbersFromVersion', () => {
    const versionArray1 = getNumbersFromVersion('4.2.0');
    expect(versionArray1.toString()).to.be.equal('4,2,0,Infinity');
    const versionArray2 = getNumbersFromVersion('5.22.1000');
    expect(versionArray2.toString()).to.be.equal('5,22,1000,Infinity');
    const versionArray3 = getNumbersFromVersion('5.2.0-beat.2');
    expect(versionArray3.toString()).to.be.equal('5,2,0,2');
    const versionArray4 = getNumbersFromVersion('5.32.10-beat.12');
    expect(versionArray4.toString()).to.be.equal('5,32,10,12');
    const versionArray5 = getNumbersFromVersion('5.32.10-beat-12');
    expect(versionArray5.toString()).to.be.equal('5,32,10,12');
    const versionArray6 = getNumbersFromVersion('5.32.10.beat-12');
    expect(versionArray6.toString()).to.be.equal('5,32,10,12');
    const versionArray7 = getNumbersFromVersion('5.32.10.bEAt-12');
    expect(versionArray7.toString()).to.be.equal('5,32,10,12');
    const versionArray8 = getNumbersFromVersion('5.32.10.BEAT.102');
    expect(versionArray8.toString()).to.be.equal('5,32,10,102');
  });

  it('should get right result for compareVersions', () => {
    expect(compareVersions('4.2.0', '4.2.0')).to.be.equal(false);
    expect(compareVersions('4.2.0', '4.3.0')).to.be.equal(true);
    expect(compareVersions('4.22.10', '5.1.0')).to.be.equal(true);
    expect(compareVersions('4.2.0', '4.2.0-beta.100')).to.be.equal(false);
    expect(compareVersions('4.2.0-beat.1', '4.2.0-beta.100')).to.be.equal(true);
    expect(compareVersions('4.2.0-beat.10000', '4.2.0-beta.100')).to.be.equal(false);
    expect(compareVersions('4.22.110-beat.10000', '5.2.0-beta.100')).to.be.equal(true);
  });
});
