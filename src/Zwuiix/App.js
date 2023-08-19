const Path = require("path");
const fs = require("fs");
const fsextra = require('fs-extra');
const AdmZip = require('adm-zip');
const { v4: uuidv4 } = require('uuid');
const Jimp = require('jimp');
const { exec } = require('child_process');

function tintPreserveBrightness(color, tintColor) {
    const colorRgb = Jimp.intToRGBA(color);
    const tintColorRgb = Jimp.intToRGBA(tintColor);

    const lum = 0.2126 * colorRgb.r + 0.7152 * colorRgb.g + 0.0722 * colorRgb.b;

    const result = {
        r: tintColorRgb.r + (colorRgb.r - tintColorRgb.r) * (1 - lum / 255),
        g: tintColorRgb.g + (colorRgb.g - tintColorRgb.g) * (1 - lum / 255),
        b: tintColorRgb.b + (colorRgb.b - tintColorRgb.b) * (1 - lum / 255),
        a: colorRgb.a
    };

    return Jimp.rgbaToInt(result.r, result.g, result.b, result.a);
}

function findPngFilesWithKeyword(rootPath, keyword, foundFiles = []) {
    const files = fs.readdirSync(rootPath);

    for (const file of files) {
        const filePath = Path.join(rootPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            findPngFilesWithKeyword(filePath, keyword, foundFiles);
        } else if (Path.extname(file).toLowerCase() === '.png' && file.toLowerCase().includes(keyword.toLowerCase())) {
            foundFiles.push(filePath);
        }
    }

    return foundFiles;
}

function findPngFiles(rootPath, foundFiles = []) {
    const files = fs.readdirSync(rootPath);

    for (const file of files) {
        const filePath = Path.join(rootPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            findPngFiles(filePath, foundFiles);
        } else {
            foundFiles.push(filePath);
        }
    }

    return foundFiles;
}

function findFiles(folderPath, name, find = []) {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        const filePath = Path.join(folderPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            findFiles(filePath, find);
        } else if (Path.extname(file) === name) {
            find.push(filePath);
        }
    }

    return find;
}

function findDirectoriesWithNames(rootPath, targetNames, foundDirectories = []) {
    const files = fs.readdirSync(rootPath);

    for (const file of files) {
        const filePath = Path.join(rootPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            if (targetNames.includes(file)) {
                foundDirectories.push(filePath);
            }
            findDirectoriesWithNames(filePath, targetNames, foundDirectories);
        }
    }

    return foundDirectories;
}

function isDirectory(path) {
    try {
        return fs.statSync(path).isDirectory();
    } catch (err) {
        return false;
    }
}

async function main()
{
    let args = process.argv;
    if(args.length !== 4) {
        console.log("Invalid parameters: path flags (path)");
        console.log();
        console.log("   -s (Path of a zipped Minecraft Java pack)");
        console.log("   -m (Path of a Zipped Minecraft Java Multi-Pack Folder)");
        return;
    }

    let input = Path.join(args[3]);
    switch (args[2].toLowerCase()) {
        case "-s":
            if(!input.endsWith(".zip")) {
                console.log("Invalid parameters: path (file.zip)");
                return;
            }

            let start = Date.now();
            let converted = await convert(input);
            if(converted) {
                console.log(`[DEBUG] The pack was converted in ${((Date.now() - start) / 1000)} seconds!`);
                //exec(`explorer "${Path.join(process.cwd() + "/output/")}"`);
            }
            break;
        case "-m":
            if(!isDirectory(input)) {
                console.error("This path is not a folder or cannot be found!");
                return;
            }

            const packs = fs.readdirSync(Path.join(input)).filter(file => file.endsWith('.zip'));
            let i = 0;
            for (const pack of packs) {
                let path = Path.join(input + "/" + pack);
                let start = Date.now();
                let converted = await convert(path);
                if(converted) {
                    i++;
                    console.log(`[DEBUG] The pack ${pack} was converted in ${((Date.now() - start) / 1000)} seconds! (${i}/${packs.length})`);
                }
                if(i >= packs.length) {
                    //exec(`explorer "${Path.join(process.cwd() + "/output/")}"`);
                    return;
                }
            }
            break;
    }
}

async function convert(input) {
    let split = input.split("\\");
    let name = split[split.length - 1].replace(".zip", "");

    let tempPath = Path.join(process.cwd() + `/temp_${name}/`);
    let outputPath = Path.join(process.cwd() + "/output/");

    if (fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, {recursive: true});
    }

    fs.mkdirSync(tempPath);
    try {
        fs.mkdirSync(outputPath);
    } catch (e) {
    }

    const zip = new AdmZip(input);
    try {
        await zip.extractAllTo(tempPath, true);
    } catch (error) {
        console.error("Can't extract zip file :", error);
        return false;
    }

    let outputPack = Path.join(outputPath + name);

    try {
        fs.mkdirSync(outputPack);
    } catch (e) {
    }

    let mcMetafiles = findFiles(tempPath, ".mcmeta");
    if (mcMetafiles.length === 0) {
        console.error("Can't find .mcmeta file");
        return false;
    }

    if (mcMetafiles.length > 1) {
        console.error("Too many .mcmeta files found!");
        return false;
    }

    let mcMeta = null;
    try {
        mcMeta = JSON.parse(fs.readFileSync(mcMetafiles[0]));
    } catch (error) {
        console.error("Can't parse mcMeta file :", error);
        return false;
    }

    fs.writeFileSync(Path.join(outputPack + "/manifest.json"), JSON.stringify({
            format_version: 1,
            header: {
                description: `Exported by MusuiConverter\n${mcMeta.pack.description}`,
                name: name,
                uuid: uuidv4(),
                version: [1, 0, 0],
                min_engine_version: [1, 12, 1]
            },
            modules: [
                {
                    description: `Exported by MusuiConverter\n${mcMeta.pack.description}`,
                    type: "resources",
                    uuid: uuidv4(),
                    version: [1, 0, 0]
                }
            ]
        })
    );
    console.log("[DEBUG] Creating manifest.json in " + outputPack);

    let packIMGPath = Path.join(tempPath + "/pack.png");
    if (fs.existsSync(packIMGPath)) {
        fsextra.copySync(packIMGPath, Path.join(outputPack + "/pack_icon.png"));
        console.log("[DEBUG] Moving and renaming pack.png file to pack_icon.png in " + outputPack);
    }
    try {
        fs.mkdirSync(outputPack + "/textures");
        console.log("[DEBUG] Creation of the textures folder in " + outputPack);
        fs.mkdirSync(outputPack + "/font");
        console.log("[DEBUG] Creation of the font folder in " + outputPack);
    } catch (e) {
    }

    let texturesFolders = findDirectoriesWithNames(tempPath, "textures");
    if (texturesFolders.length === 0) {
        console.error("Can't find textures folder");
        return false;
    }

    if (texturesFolders.length > 1) {
        console.error("Too many textures folders found!");
        return false;
    }

    const textures = fs.readdirSync(Path.join(texturesFolders[0]));
    for (const texture of textures) {
        switch (texture.toLowerCase()) {
            case "models":
                fsextra.copySync(Path.join(texturesFolders[0] + `/models/`), Path.join(outputPack + `/textures/${texture}`));
                const models = fs.readdirSync(Path.join(outputPack + "/textures/models/armor/"));
                for (const model of models) {
                    if(model.includes("_layer_")) {
                        let split = model.replaceAll("chainmail", "chain").split("_layer_");
                        fs.renameSync(Path.join(outputPack + "/textures/models/armor/" + model), Path.join(outputPack + "/textures/models/armor/" + `${split[0]}_${split[1]}`));
                    }
                }
                break;
            default:
                await fsextra.copySync(Path.join(texturesFolders[0] + `/${texture}`), Path.join(outputPack + `/textures/${texture}`));
                break;
        }
    }

    const allTexturesPNG = findPngFiles(Path.join(outputPack + `/textures/items/`));
    for (const textureFile of allTexturesPNG) {
        await Jimp.read(Path.join(textureFile))
            .then(texture => {
                texture.scan(0, 0, texture.bitmap.width, texture.bitmap.height, function(x, y, idx) {
                    const pixelColor = this.getPixelColor(x, y);
                    if (pixelColor === 0x010101 || pixelColor === 0x010101FF) {
                        this.setPixelColor(Jimp.rgbaToInt(255, 0, 0, 0), x, y);
                    }
                });

                return texture.writeAsync(Path.join(textureFile));
            })
            .then(() => {
                console.log(`[DEBUG] Fixing texture in ${textureFile}!`);
            })
            .catch(err => {});
    }

    let potions = findPngFilesWithKeyword(outputPack, "potion_");

    let backgroundSplashPotion = "";
    let overlaySplashPotion = "";
    potions.forEach((path) => {
        if (path.includes("potion_bottle_splash.png")) {
            backgroundSplashPotion = path;
            console.log(`[DEBUG] Potion background image successfully find!`);
        } else if (path.includes("potion_overlay.png")) {
            overlaySplashPotion = path;
            console.log(`[DEBUG] Image of potion overlay find successfully!`);
        }
    })


    if (backgroundSplashPotion !== "" && overlaySplashPotion !== "") {
        const pots = JSON.parse(fs.readFileSync(Path.join(process.cwd() + "/resources/potions.json")));
        let config = Object.entries(pots);
        for (let i = 0; i < config.length; i++) {
            let potsName = config[i][0];
            let potsColor = config[i][1];

            await Jimp.read(backgroundSplashPotion)
                .then(async backgroundImage => {
                    return await Jimp.read(overlaySplashPotion)
                        .then(async overlayImage => {
                            overlayImage.resize(backgroundImage.getWidth(), backgroundImage.getHeight());
                            overlayImage.scan(0, 0, overlayImage.getWidth(), overlayImage.getHeight(), function (x, y, idx) {
                                const pixelColor = this.getPixelColor(x, y);
                                const newColor = tintPreserveBrightness(pixelColor, Jimp.cssColorToHex(potsColor));
                                this.setPixelColor(newColor, x, y);
                            });

                            return overlayImage;
                        })
                        .then(async teintedOverlay => {
                            return teintedOverlay.clone().composite(backgroundImage, 0, 0, {
                                mode: Jimp.BLEND_SOURCE_OVER,
                                opacityDest: 1,
                                opacitySource: 1
                            });
                        })
                        .then(async resultImage => {
                            return await resultImage.writeAsync(Path.join(outputPack + `/textures/items/${potsName}.png`));
                        });
                })
                .then(() => {
                    console.log(`[DEBUG] Successfully overlaid and tinted overlay ${potsName} image.`);
                })
                .catch(err => {
                    console.error('Error when tinting and overlaying images:', err);
                    return false;
                });
        }
    }

    const packZip = new AdmZip();
    packZip.addLocalFolder(outputPack);
    packZip.writeZip(Path.join(outputPath + `${name}.mcpack`));
    fs.rmSync(tempPath, {recursive: true});
    return true;
}
main().then(r => {});