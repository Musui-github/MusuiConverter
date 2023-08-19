# MusuiConverter

Here is some information about the project!

### What is MusuiConverter?
This script converts a pack from the Java version of Minecraft to the Bedrock Edition version.

### Required things
- NodeJS

### How to use it?
```
node converter.js (flags) (path)
```

What are flags?
- -s (Path of a zipped Minecraft Java pack)
- -m (Path of a Zipped Minecraft Java Multi-Pack Folder)

### Example to use (MultiPack)
```
node converter.js -m "C:\Users\%username%\AppData\Roaming\.minecraft\resourcepacks"
```

### Frequently encountered bug
One or many textures in a texture pack may contain black outlines, sword potions, or something else.

The solution is simple: erase the invisible area with the eraser with **Paint.net** or **Photoshop**.

## Contributors
- [@Zwuiix-cmd](https://github.com/Zwuiix-cmd)

## Licensing information
This project is licensed under LGPL-3.0. Please see the [LICENSE](/LICENSE) file for details.
