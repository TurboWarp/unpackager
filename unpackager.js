/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

var unpackage = (function() {
  'use strict';

  /**
   * @returns {Promise<JSZip>}
   */
  const unzipOrNull = async (binaryData) => {
    try {
      return await JSZip.loadAsync(binaryData);
    } catch (e) {
      return null;
    }
  };

  /**
   * @param {Blob} blob
   * @returns {Promise<string>}
   */
  const readAsText = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read blob as text'));
    reader.readAsText(blob);
  });

  /**
   * @param {string} string
   * @param {RegExp} regex
   * @returns {string[][]}
   */
  const matchAll = (string, regex) => {
    const result = [];
    let match = null;
    while ((match = regex.exec(string)) !== null) {
      result.push(match);
    }
    return result;
  };

  const getContainingFolder = (name) => {
    const parts = name.split('/');
    parts.pop();
    return parts.join('/');
  };

  const identifyProjectJSONType = (data) => {
    if ('targets' in data) {
      return 'sb3';
    } else if ('objName' in data) {
      return 'sb2';
    }
    throw new Error('Can not determine project.json type');
  };

  const decodeBase85WithLengthHeader = (str) => {
    const decode_1 = (str) => {
      // The initial version of base85
      // https://github.com/TurboWarp/packager/blob/9234d057585132d2514a831476abbcf2a7b9b151/src/packager/lib/base85-encode.js
      // "0x29 - 0x7d of ASCII with 0x5c (\) replaced with 0x7e (~)"
      const getValue = (code) => {
        if (code === 0x7e) {
          return 0x5c - 0x29;
        }
        return code - 0x29;
      };
      const toMultipleOfFour = (n) => {
        if (n % 4 === 0) {
          return n;
        }
        return n + (4 - n % 4);
      };
      const stringToBytes = (str) => new TextEncoder().encode(str);
      const lengthEndsAt = str.indexOf(',');
      const byteLength = +str.substring(0, lengthEndsAt);
      const resultBuffer = new ArrayBuffer(toMultipleOfFour(byteLength));
      const resultView = new DataView(resultBuffer);
      const stringBytes = stringToBytes(str);
      for (let i = lengthEndsAt + 1, j = 0; i < str.length; i += 5, j += 4) {
        resultView.setUint32(j, (
          getValue(stringBytes[i + 4]) * 85 * 85 * 85 * 85 +
          getValue(stringBytes[i + 3]) * 85 * 85 * 85 +
          getValue(stringBytes[i + 2]) * 85 * 85 +
          getValue(stringBytes[i + 1]) * 85 +
          getValue(stringBytes[i])
        ), true);
      }
      return new Uint8Array(resultBuffer, 0, byteLength);
    };

    const decode_2 = (str) => {
      // Second version, modified to be HTML safe
      // https://github.com/TurboWarp/packager/blob/44638a3f6daf03290c4020c5fd0d022edc1d0229/src/packager/lib/base85-encode.js
      // "The character set used is 0x2a - 0x7e of ASCII"
      // "0x3c (<) is replaced with 0x28 (opening parenthesis) and 0x3e (>) is replaced with 0x29 (closing parenthesis)"
      const getValue = (code) => {
        if (code === 0x28) code = 0x3c;
        if (code === 0x29) code = 0x3e;
        return code - 0x2a;
      };
      const toMultipleOfFour = (n) => {
        if (n % 4 === 0) {
          return n;
        }
        return n + (4 - n % 4);
      };
      const stringToBytes = (str) => new TextEncoder().encode(str);
      const lengthEndsAt = str.indexOf(',');
      const byteLength = +str.substring(0, lengthEndsAt);
      const resultBuffer = new ArrayBuffer(toMultipleOfFour(byteLength));
      const resultView = new DataView(resultBuffer);
      const stringBytes = stringToBytes(str);
      for (let i = lengthEndsAt + 1, j = 0; i < str.length; i += 5, j += 4) {
        resultView.setUint32(j, (
          getValue(stringBytes[i + 4]) * 85 * 85 * 85 * 85 +
          getValue(stringBytes[i + 3]) * 85 * 85 * 85 +
          getValue(stringBytes[i + 2]) * 85 * 85 +
          getValue(stringBytes[i + 1]) * 85 +
          getValue(stringBytes[i])
        ), true);
      }
      return new Uint8Array(resultBuffer, 0, byteLength);
    };

    const decode_3 = (str) => {
      // Third version, length header was is now encoded so people don't misinterpret it
      // https://github.com/TurboWarp/packager/blob/61b6905853320332dd44b08f9f7ab03c4b3542b9/src/packager/base85.js
      const getValue = (code) => {
        if (code === 0x28) code = 0x3c;
        if (code === 0x29) code = 0x3e;
        return code - 0x2a;
      };
      const toMultipleOfFour = (n) => {
        if (n % 4 === 0) {
          return n;
        }
        return n + (4 - n % 4);
      };
      const lengthEndsAt = str.indexOf(',');
      const byteLength = +str
        .substring(0, lengthEndsAt)
        .split('')
        .map(i => String.fromCharCode(i.charCodeAt(0) - 49))
        .join('');
      const resultBuffer = new ArrayBuffer(toMultipleOfFour(byteLength));
      const resultView = new DataView(resultBuffer);
      for (let i = lengthEndsAt + 1, j = 0; i < str.length; i += 5, j += 4) {
        resultView.setUint32(j, (
          getValue(str.charCodeAt(i + 4)) * 85 * 85 * 85 * 85 +
          getValue(str.charCodeAt(i + 3)) * 85 * 85 * 85 +
          getValue(str.charCodeAt(i + 2)) * 85 * 85 +
          getValue(str.charCodeAt(i + 1)) * 85 +
          getValue(str.charCodeAt(i))
        ), true);
      }
      return new Uint8Array(resultBuffer, 0, byteLength);
    };

    const header = str.substring(0, str.indexOf(','));
    // Version 1 and 2 use numbers for the length header while version 3 encodes it
    if (/^\d+$/.test(header)) {
      // Version 2 uses \, version 1 does not
      // This is accurate enough for now. Technically someone could encode something with
      // version 2 that doesn't include \, but projects are effectively random bytes to
      // zip compression so the likelihood of that happening randomly is pretty low.
      if (str.includes('\\')) {
        return decode_2(str);
      }
      return decode_1(str);
    }
    return decode_3(str);
  };

  const decodeBase85WithoutLengthHeader = (str, length) => {
    // Base 85, version 4: Length header is gone

    const getBase85DecodeValue = (code) => {
      if (code === 0x28) code = 0x3c;
      if (code === 0x29) code = 0x3e;
      return code - 0x2a;
    };

    const buffer = new ArrayBuffer(Math.ceil(length / 4) * 4);
    const view = new DataView(buffer, 0, Math.floor(str.length / 5 * 4));
    for (let i = 0, j = 0; i < str.length; i += 5, j += 4) {
      view.setUint32(j, (
        getBase85DecodeValue(str.charCodeAt(i + 4)) * 85 * 85 * 85 * 85 +
        getBase85DecodeValue(str.charCodeAt(i + 3)) * 85 * 85 * 85 +
        getBase85DecodeValue(str.charCodeAt(i + 2)) * 85 * 85 +
        getBase85DecodeValue(str.charCodeAt(i + 1)) * 85 +
        getBase85DecodeValue(str.charCodeAt(i))
      ), true);
    }
    return new Uint8Array(buffer, 0, length);
  };

  /**
   * @param {string} str
   * @returns {Uint8Array}
   */
  const decodeBase64 = (str) => {
    const decoded = atob(str);
    const result = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      result[i] = decoded.charCodeAt(i);
    }
    return result;
  };

  /**
   * @param {string} uri
   */
  const decodeDataURI = (uri) => {
    const parts = uri.split(';base64,');
    if (parts.length < 2) {
      throw new Error('Data URI is not base64');
    }
    const base64 = parts[1];
    return decodeBase64(base64);
  };

  /**
   * Find a file in a JSZip using its name regardless of the folder it's in.
   * @param {JSZip} zip
   * @param {string} path
   * @returns {JSZip.File|null}
   */
  const findFileInZip = (zip, path) => {
    const f = zip.file(path);
    if (f) {
      return f;
    }
    for (const filename of Object.keys(zip.files)) {
      if (filename.endsWith(`/${path}`)) {
        return zip.file(filename);
      }
    }
    return null;
  };

  const unpackageBinaryBlob = async (data) => {
    const projectZip = await unzipOrNull(data);

    if (projectZip) {
      // The project is a compressed sb2 or sb3 project.
      const projectJSON = findFileInZip(projectZip, 'project.json');
      const projectJSONData = JSON.parse(await projectJSON.async('text'));
      const type = identifyProjectJSONType(projectJSONData);
      return {
        type,
        data
      };
    }

    // The project is a Scratch 1 project.
    return {
      type: 'sb',
      data
    };
  };

  const zipToArrayBuffer = (zip) => {
    for (const file of Object.values(zip.files)) {
      file.date = new Date(1662869887000); // date of first unpackager commit :)
    }
    return zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE'
    });
  };

  const unpackage = async (blob) => {
    const packagedZip = await unzipOrNull(blob);

    if (packagedZip) {
      // Raw sb2, raw sb3, and zip files generated by TurboWarp Packager have a project.json alongside the assets.
      const projectJSON = findFileInZip(packagedZip, 'project.json');
      if (projectJSON) {
        const innerFolderPath = getContainingFolder(projectJSON.name);
        const innerZip = packagedZip.folder(innerFolderPath);

        let sb3Assets = 0;
        let sb2Assets = 0;

        // Remove extra files that aren't part of the project but are in the same folder
        // This removes extra files from HTMLifier zips of Scratch 3 projects
        for (const path of Object.keys(innerZip.files)) {
          if (path === 'project.json') {
            // keep
          } else if (/^[a-f0-9]{32}\.[a-z0-9]{3}$/i.test(path)) {
            // sb3 asset; keep
            sb3Assets++;
          } else if (/^[0-9]+\.[a-z0-9]{3}$/i.test(path)) {
            // sb2 asset; keep
            sb2Assets++;
          } else {
            innerZip.remove(path);
          }
        }

        // Guess project time based on assets because we can't reliably parse the JSON without
        // importing @turbowarp/json. Only count as sb2 if we saw an sb2-style asset name and
        // and nothing that looks like an sb3. sb3 is much more common so if we're unsure,
        // we'll lean towards that if there's any ambiguity.
        const type = sb2Assets > 0 && sb3Assets === 0 ? 'sb2' : 'sb3';

        return {
          type,
          data: await zipToArrayBuffer(innerZip)
        };
      }

      const projectBinary = (
        // Zip files generated by the TurboWarp Packager, the legacy TurboWarp Packager, or the forkphorus packager
        // can have a "project.zip" file
        findFileInZip(packagedZip, 'project.zip') ||
        // Zip files generated by HTMLifier for Scratch 1 projects have a "project" file
        findFileInZip(packagedZip, 'project')
      );
      if (projectBinary) {
        const projectData = await projectBinary.async('arraybuffer');
        return unpackageBinaryBlob(projectData);
      }

      throw new Error('Input was a zip but we could not find a project.')
    }

    const text = await readAsText(blob);

    // HTML files generated by some versions of the TurboWarp Packager use base85 in several inline script tags
    // that decode progressively (For simplicity we still just concatenate)
    // https://github.com/TurboWarp/packager/pull/861
    let base85Matches = matchAll(text, /<script data="([^"]+)">decodeChunk\((\d+)\)<\/script>/g);
    if (base85Matches.length) {
      const base85 = base85Matches.map(i => i[1]).join('');
      const length = base85Matches.map(i => +i[2]).reduce((a, b) => a + b, 0);
      return unpackageBinaryBlob(decodeBase85WithoutLengthHeader(base85, length));
    }

    // HTML files generated by some versions of the TurboWarp Packager use base85 in several inline script tags
    // that get concatenated at the end.
    base85Matches = matchAll(text, /<script type="p4-project">([^<]+)<\/script>/g);
    if (base85Matches.length) {
      const base85 = base85Matches.map(i => i[1]).join('');
      return unpackageBinaryBlob(decodeBase85WithLengthHeader(base85));
    }

    // HTML files generated by some versions of the TurboWarp Packager use base85 in one big script tag
    let base85Match = (
      // https://github.com/TurboWarp/packager/commit/45838ee9ced603058b774587b01808c2fae991ec
      text.match(/const result = base85decode\("(.+)"\);/) ||
      // https://github.com/TurboWarp/packager/commit/44638a3f6daf03290c4020c5fd0d022edc1d0229
      text.match(/<script id="p4-encoded-project-data" type="p4-encoded-project-data">([^<]+)<\/script>/)
    );
    if (base85Match) {
      const base85 = base85Match[1];
      return unpackageBinaryBlob(decodeBase85WithLengthHeader(base85));
    }

    const dataURIMatch = (
      // HTML files generated by old version of the TurboWarp Packager use inline base64
      // https://github.com/TurboWarp/packager/blob/33b7b8c43986485a97e6885a2bb004d6fcc20b08/src/packager/packager.js#L362-L368
      text.match(/const getProjectData = \(\) => fetch\("([a-zA-Z0-9+/=\-:;,]+)"\)/) ||
      // HTML files generated by the forkphorus packager use an inline base64 URL
      text.match(/var project = '([a-zA-Z0-9+/=\-:;,]+)';/) ||
      // HTML files generated by the legacy TurboWarp Packager use an inline base64 URL
      text.match(/window\.__PACKAGER__ = {\n    projectData: "([a-zA-Z0-9+/=\-:;,]+)"/)
    );
    if (dataURIMatch) {
      const dataURI = dataURIMatch[1];
      return unpackageBinaryBlob(decodeDataURI(dataURI));
    }

    // HTML files generated by some versions of HTMLifier store the project as fields in initOptions
    let htmlifierOptions = text.match(/<script>\nconst GENERATED = \d+\nconst initOptions = ({[\s\S]+})\ninit\(initOptions\)\n<\/script>/m);
    if (htmlifierOptions) {
      const htmlifierAssets = JSON.parse(htmlifierOptions[1]).assets;

      const compressedProjectData = htmlifierAssets.file;
      if (compressedProjectData) {
        // The project is a Scratch 1 project
        const decodedProjectData = decodeDataURI(compressedProjectData);
        return {
          type: 'sb',
          data: decodedProjectData
        };
      }

      // The project is a Scratch 3 project with assets listed individually in the JSON options
      // or the project was a Scratch 2 project which HTMLifier converts to Scratch 3
      const newZip = new JSZip();
      for (const name of Object.keys(htmlifierAssets)) {
        const nameInZip = name === 'project' ? 'project.json' : name;
        const dataURI = htmlifierAssets[name];
        newZip.file(nameInZip, decodeDataURI(dataURI));
      }

      return {
        type: 'sb3',
        data: await zipToArrayBuffer(newZip)
      };
    }

    // HTML files generated by older versions of HTMLifier with TYPE === "json" have PROJECT_JSON and ASSETS constants
    // https://github.com/SheepTester/htmlifier/blob/b80b860f64bf7c4a908f3c9e74bac6285b7a1687/hacky-file-getter.js#L166
    htmlifierOptions = text.match(/var TYPE = 'json',\nPROJECT_JSON = "([^"]*)",\nASSETS = ({[^}]*}),/m);
    if (htmlifierOptions) {
      const projectJSON = decodeDataURI(htmlifierOptions[1]);
      const assetsJSON = JSON.parse(htmlifierOptions[2]);

      const newZip = new JSZip();
      newZip.file('project.json', projectJSON);
      for (const name of Object.keys(assetsJSON)) {
        newZip.file(name, decodeDataURI(assetsJSON[name]));
      }

      return {
        type: 'sb3',
        data: await zipToArrayBuffer(newZip)
      };
    }

    throw new Error('Input was not a zip and we could not find project.');
  };

  return unpackage;
}());
