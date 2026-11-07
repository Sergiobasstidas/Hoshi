# Fuentes de `data/raw/red`

Respuestas de servicios externos guardadas tal cual por `scripts/catalog/red.js` (`npm run descargar:red`, con `HOSHI_RED=descargar`). Descarga hecha desde el Mac de Sergio el 07/11/2026 (las horas del índice están en UTC). `npm run catalogo` las reutiliza sin red: cada consulta se guarda en `<paso>/<huella>.txt`, donde la huella es el sha1 de la URL y del cuerpo de la consulta, y `<paso>/indice.json` trae la URL, la fecha, el tamaño y el sha256 de cada respuesta.

Las consultas que fallaron al descargar se guardan como error y se repiten igual sin red (el paso omite lo mismo que omitió al descargar).

Licencias y condiciones de uso: las de cada servicio (SIMBAD/CDS, NASA Exoplanet Archive, MAST, Gaia/ESA, JMMC), citadas en el encabezado de cada paso.

## `gaia_simbad` — `scripts/catalog/build_gaia_simbad.js`

Servicio: SIMBAD (CDS), TAP. Consultas: 2 (0 con error). Descarga: 2026-11-07T17:10:16Z – 2026-11-07T17:10:17Z. Total: 7313 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `29c31de231f31bb6f0568f83ea36b1a69bdb411c.txt` | simbad.harvard.edu | 3925 | `883f0bd3449998600ec25113b073ef1bdb610d861d280cb1de74efc59bec3559` |
| `310936447762ad18503815fb0863cde52417da58.txt` | simbad.harvard.edu | 3388 | `0e972a91dec9a6d5e66a0a5181a383beb2c610ff11a44d7cdafc117e824b1ee9` |

## `jmdc` — `scripts/catalog/build_jmdc.js`

Servicio: JMDC (JMMC), página http://jmdc.jmmc.fr/. Consultas: 1 (0 con error). Descarga: 2026-11-07T17:10:22Z – 2026-11-07T17:10:22Z. Total: 1835612 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `06ea65e8ef33efda2460d9031a5183b8d9c39a03.txt` | jmdc.jmmc.fr | 1835612 | `e3f8bbaf3ec95ee71692ecc8bca002dc003583c980c27450e15c8da7a41fdc9d` |

## `alias` — `scripts/process_star_aliases.js`

Servicio: SIMBAD (CDS), TAP. Consultas: 2 (0 con error). Descarga: 2026-11-07T17:10:26Z – 2026-11-07T17:10:35Z. Total: 3398863 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `452679c174cced581c487d2dd4116e5b87fc3897.txt` | simbad.harvard.edu | 173373 | `8dccb55ad8846f0702fa611719d654603c8ef29ca730a17056d511e59f701a64` |
| `10393dd6686ebc183880dcd3f820d6b95e2f0e6a.txt` | simbad.harvard.edu | 3225490 | `811cca037a533a5bf291d3becb8af66ccee0714a3882647ec7d4ab485e458491` |

## `oficiales` — `scripts/process_stellar_official.js`

Servicio: NASA Exoplanet Archive, MAST (TIC v8.2), SIMBAD y Gaia DR3 (ARI Heidelberg). Consultas: 57 (8 con error: tiempo agotado en MAST). Descarga: 2026-11-07T17:23:02Z – 2026-11-07T17:29:43Z. Total: 1380614 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `6f5b79b13199aa021edb6118cd7d31905061be82.txt` | exoplanetarchive.ipac.caltech.edu | 45557 | `afb0ceb964962a1e1a340e16e3d347d26b8a854b9af825588fb6b6e0340f8458` |
| `f2f02631df7ac838d2396a15fd264b6ec5a9f0c7.txt` | mast.stsci.edu | 340074 | `9c1e94160ffe59212d63695a9128eed42a9a9189fe9cd02a27276c21cdf99f37` |
| `6ed0fbd8be1961bc8ca71892a83335008116ce02.txt` | mast.stsci.edu | 316071 | `5ec7a05f341e3bbae341de38ba4fd05077b4ea1d35a2a3e67a65427f9c3e59ad` |
| `b25ebf9b72a98c882e5b1d8dd87fba1f36c86e4b.txt` | mast.stsci.edu | 292494 | `9178b84bdaabc08f05ae45cc5b76c8a164eddcfe196d56f33b662a27faa41071` |
| `f2911beca66544f5a8241c371dfdc05e8653d058.txt` | simbad.harvard.edu | 3118 | `b8e86c57ca64d5939201244ed8101efed0df7378319fa3e22610b4c54baf6ac7` |
| `d7437d7c48c983f78ad2e9cbcfc4287600c4cf8c.txt` | simbad.harvard.edu | 155981 | `037b8e4cc9dff792bf72714b780b8711a5bb8b356d1738d187f096c34ddafcab` |
| `0fbf41c540da7aaef75c1c033151e6aa6decdea4.txt` | simbad.harvard.edu | 3693 | `70c11f18bc4909ee8aa4fcfe5008fa448026aa0b41afe7c03adf3b993fa479c4` |
| `dee0d0917ccc1323ca8eb32ccd79c138518aef81.txt` | simbad.harvard.edu | 3211 | `8febc6309a80e94e71cc8690f1c2a0c6c9b55b460efe2a96756aa05ff06da986` |
| `9cd4189b62a49f94989b190a4ccc5150e8dcd6ce.txt` | simbad.harvard.edu | 74965 | `9bb9b9d629bebaf88bf89c111065ff7ae6c831bcda4ae8b2916c9970c7a088ea` |
| `9603a4a2074c7fbfe2866d67fac054ae194b755e.txt` | simbad.harvard.edu | 3421 | `1d6e1ff5d5af54aee9d9b4cc1bfaa509a0b3b67c1f22f65c6463ce8d26c1d80d` |
| `300057f6dd8d269110bf76b6aae08798b20e99b3.txt` | simbad.harvard.edu | 3170 | `473928d6180cd2dc6904298c0af4fbf356bd47f11e7e4601559fedce62710cab` |
| `fcc7a795168d3af8f6d27b88ba20e29f9220363a.txt` | simbad.harvard.edu | 45088 | `9914ea6e0f5502ceea9e209217c9ca9b9d57a3829cc2b5802a8ddeda5d1a0b13` |
| `4ab048b182d85f805ce1a7b733b84efdafc751f0.txt` | simbad.harvard.edu | 2668 | `de1cbc21867fd98cf4041fac27e7a65feb97171197e0b8c553f6dab42f1347fb` |
| `98ee3afe47ad449c474b5b453fff3983736f45b8.txt` | simbad.harvard.edu | 1599 | `853f4263fd7d9f12e16932424b2c39ecc13c3786123cc76e28a835c5c6775bb7` |
| `d97c98b6b43766b0a12816008532a557f5e0fcd1.txt` | simbad.harvard.edu | 1873 | `84c06e80d4e5265ff7c7dc3680a880992bb7e193e84df85ce3766c1988d590d8` |
| `dc36c59d47e93a07038a3014a16b5c51e4b3bd47.txt` | simbad.harvard.edu | 1857 | `fa8b34d0f74a6d49b364fa990b235b76ca8072895f7f34cc77c74c58c37ac022` |
| `c3f56c33e475c6149e372df622344477f541ceac.txt` | simbad.harvard.edu | 1554 | `208d98c9893205a9a8c8828a3f5a8442fa868fa7a4240a90f1159ce72999375c` |
| `55baa8717b4301d952500efa2aa614f698d4e392.txt` | simbad.harvard.edu | 2153 | `c962e5d5dd47707cb5daf5e2f55a0442550af19d551d5d59f2375bfae71b8122` |
| `ce1e65bcb5a40cb4deb6472e13d7bc78c75798a7.txt` | simbad.harvard.edu | 1746 | `ef00030b6cd8b0dd18db946ce464b4fdf9d0e306e43515d88fd56d2f9a92c3c3` |
| `704d6a232c05c633c0dcab9d51d6d17907d2fbda.txt` | simbad.harvard.edu | 1485 | `7e490772ae74d92753ec9ddb5196c0eae3667ba5f9ca82ad12dcef20b50c1b5b` |
| `f9ae72a7cdd7abb667e8719ebbe0a95ad16339eb.txt` | simbad.harvard.edu | 1747 | `13e4db3d400f822e742b47ec35e624de502b205ee6422b57b888187f18e0e822` |
| `08103922adf2c7f8767b8773c85b161c4892a5e7.txt` | simbad.harvard.edu | 2235 | `1c93090be27dd7758cd79d082fd1804f62d9d6d776900b5dc6acd5a69a1cb868` |
| `16305d3c0af19c6d3687e42abf3815532090bc13.txt` | simbad.harvard.edu | 1707 | `f1ce495a3a58cfe8c4f71a98b59b52002416a5803db0f0bbb2f6acb2a8e45828` |
| `d81bd9c6cb78c1809e62e8710cb3978027ae02a2.txt` | simbad.harvard.edu | 2031 | `696eade662558fd4b999c0df224b6acff61456b397721dec14d6e2398eb535e0` |
| `141f3e05f8c291f6152c540958d4e4e58c501055.txt` | simbad.harvard.edu | 1999 | `b73c05b3175a87b8f71cdc6c4ebf84b6323cd083c3f118b567616d73fc76eab6` |
| `71da021641e8e71932216539f42048d47f6780b6.txt` | simbad.harvard.edu | 1957 | `f78f36c6dff058a9994f7e699274ab9fe76ba3d4a5aa81de2d0bb5973e6301ba` |
| `ddaf2b0e0a081ee84c685bc3f305459ce8163652.txt` | simbad.harvard.edu | 1810 | `33bc7c1f84b3df934f83eb6fef24ca5cbf929d256c7c710a5b08072f8b0fa427` |
| `21515025a4f2fa6160b65a7f65132db3de758060.txt` | simbad.harvard.edu | 1812 | `57e1030da22711678360006f6faf6224b1745703fb8967721c5e9533a90133c4` |
| `6d35870bcf23dda5c0243ca88b6f5d8c2338d07d.txt` | simbad.harvard.edu | 1839 | `253136dd2be623dd13f59bb445f0a0341ec28b68a26b3c902c2a7a8c4fe87242` |
| `70142ac0b43dc31b0032043ecd7686414539bc2f.txt` | simbad.harvard.edu | 1816 | `d8ecfe5bc26be0f11975b07da93c8005f2585f4d6fe141902b13252f95e18f02` |
| `1d88277628ee002b0224eb46ce0fa8adc54b5e70.txt` | simbad.harvard.edu | 2065 | `b935348cc349acf08cde6c8cb0f668c3e1fa56e9fdf2c56eb345b00f49962a8f` |
| `d6591d2cb683ed6a1f1c6992a5c76bd0cd27e6f3.txt` | simbad.harvard.edu | 1823 | `17b03611a7e1b862dfef0c593276814be2f2055917c5d8d9bb12b8b7abfa759e` |
| `37152b3bfb94ced178e929d664e4afdc644c51be.txt` | simbad.harvard.edu | 2409 | `9a902a1c25fdf0d4703b4017257ab723843da0f49df51bc5cdc70c13efe20a48` |
| `1a0c53859161335f26f8423cafc04913e2c157de.txt` | simbad.harvard.edu | 2199 | `f66b3bf4d2ca611346d7dfb50ef373bdcb635314c33dc0eec1648eeb820166cb` |
| `67ded18e495fd2e9f12b92b25faf803a4b450d09.txt` | simbad.harvard.edu | 2092 | `04734defade02a2a9e80d45570926ccc84d6a9204d0f81d68191d4ee9d568991` |
| `c04d64233702273a245e1bf09481bc18fb7d8f29.txt` | simbad.harvard.edu | 2312 | `77001697839e79a79916e7c803acb8d347b1a7144ebf89d36ff2d9195129acbb` |
| `6462344490071e3a501c0ff41befb07185b6cd86.txt` | simbad.harvard.edu | 1772 | `824a3bf92d8d931df15861e6277a83e926bfd01fd7d3266f6ff03522ddf9a00c` |
| `a9d2ace2a09f965cab7cdc020035562ebdbc40d6.txt` | simbad.harvard.edu | 2124 | `d99f02c190bf0c3a179641653845a1742c2e59f563f44a5e4368bf6a80d264dd` |
| `7b4e7fc5e3682e2dd4fa24bad2683f4ce42be071.txt` | simbad.harvard.edu | 1839 | `c0f08e1b1b9ae08626071bc24c82e9daa48d92b3d525dd222fbef986c928333a` |
| `d2f34c10a30c6da470fe6df75af6935c21ee1c7b.txt` | simbad.harvard.edu | 2186 | `50d861099519d9db9654cbca20ba4b8bafde866f037e2e43b93e9b12e6a22f51` |
| `74159e551b3777bfe16166e3d1203af3b357a27e.txt` | simbad.harvard.edu | 1974 | `86158537a4589ec527afa60c4bb8cd1a4f0bfc1b7f72f679742244f566d6340c` |
| `d101dc4d2e1d0803c790330f2d803ab4a2876db3.txt` | simbad.harvard.edu | 1299 | `1547ad92d970dd28ad17fbd5559ecf79fa7ece1b41b6200fde9ed937108e7b90` |
| `0d814f8f001bce11566d30f31042fac2e4dfaa06.txt` | simbad.harvard.edu | 1960 | `5a0016a727dffb49da207ba3d76170e816a0dbb97d368a0fbad14ecf6a82fe91` |
| `934c789fb49cdd6571d5da5371b3022ad6e60e70.txt` | simbad.harvard.edu | 2087 | `d953a1373d6a553982d10e6a86d5a0b14bb3ff91ead7c374f825345cb9a887b1` |
| `be1daadde06d798bc21e1e2ec48cae18faadc9db.txt` | simbad.harvard.edu | 1583 | `afdef0873fcbb62056026eb82959109fe78ae2086a15fb2e0420de2f4f252237` |
| `cb56209eca6107aacb3f8be0997eb028423c8c27.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `007a51b8c0d5e7a9196213fa1a546dd47608b610.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `93b1030fb1335fa86eb2b293c09c76493420dcd2.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `86e58d4a2701d7eb8f851198105906dcb858ae7e.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `c6c414fcc6f846cd5dfefa8b5eabae33451a6b28.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `52544c8f5e34e8804608a362dc8fbb8ce618f0ab.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `58fcd355b1bd875b87eb66283eaf37fa8f1e4cea.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `5ddc6505c2f98766424999a7765ade4b925469c3.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `d20c8004d7535b693afb9a61ddb7da5ec35b016f.txt` | gaia.ari.uni-heidelberg.de | 12524 | `ffb744b1b2ee9b30a1d204ebc8bbc1b372ea590cc728ebfc89fee3904ed65f16` |
| `791847bb3ae46219cb9fdccf71e5a070b32f19ee.txt` | gaia.ari.uni-heidelberg.de | 12526 | `0c24ffa12fed0829f5ac26be130559f7e96b8e655eccb185d535c3a08d1a7112` |
| `f272e46ea9cf02b9352412563f85171f442ca963.txt` | gaia.ari.uni-heidelberg.de | 4518 | `9cc49ffa090354cff38549efd96b548aa67afb67d74aa30ddb573d12ace568a3` |
| `a62b9b1417c778b89657860f725a262cc8b4ed75.txt` | gaia.ari.uni-heidelberg.de | 223 | `307d70875e99c3f156c5e4c73805d050b7664a1abe588f76320089da1422272b` |

## `fichas` — `scripts/process_fichas.js`

Servicio: NASA Exoplanet Archive, SIMBAD y Gaia DR3 (ESA). Consultas: 8 (0 con error). Descarga: 2026-11-07T17:17:15Z – 2026-11-07T17:21:39Z. Total: 1696760 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `971be7cdae1e2058986f3a80ae0e4774980f6981.txt` | exoplanetarchive.ipac.caltech.edu | 1638549 | `0864259375045df30a863d8bd38c87fec608f5007b2e6edc3b1c9e30f959272f` |
| `09a9a678be2582597a15b2836f6bcd4badd6f6cc.txt` | simbad.harvard.edu | 4938 | `2b1b04dfca5ae18cf8eb1c1fb568eb40abdf4b57836401a6b5118d28ef78dbe9` |
| `c9dad5b0e4d0dd4e802dbfd7113d2e29ff0a0606.txt` | simbad.harvard.edu | 5407 | `973769f5a9483a37cd13543bcb5fb8c16cffb958818772989b291c0c613d29b2` |
| `3420bed33babebbf6ac375ee4d2832f4f3789606.txt` | simbad.harvard.edu | 5055 | `45336a028f48b852c7549f6c06c01f94ac4853c974f13363ce5ca4c6ac9f4173` |
| `caffc469616faec6e826b9ecc1d4d9102141c4d8.txt` | gea.esac.esa.int | 17059 | `2042431b5f6a8ce96808435262088e070d4060ddce004a095a82c024db18d201` |
| `901945139e0b77ee71c98f7897b582c5ff4c95a7.txt` | gea.esac.esa.int | 6754 | `2f64bc1be8958f2c5b6710a3bc6a0f40668c8a1f93f59d54437c6e27736c3941` |
| `cc4b7a509bedce085994ca207cf28f4328b87335.txt` | gea.esac.esa.int | 13631 | `280d1a0ec635a32fc4560a726e5d47fc9f78787faa1f2fa3c7258c7495102cfc` |
| `6884638dc164a0779b9c6c04f434e3feda026ac0.txt` | gea.esac.esa.int | 5367 | `a30e31fb64a0d0c7b3804c0dd4e00f2241f160dda7831fe176d4c7ac0bfc3197` |

## `cumulos` — `scripts/process_cumulos.js`

Servicio: SIMBAD (CDS), TAP. Consultas: 1 (0 con error). Descarga: 2026-11-07T17:21:46Z – 2026-11-07T17:21:46Z. Total: 88419 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `75c4b7932e198571ea044de22cc50a3c5f58546e.txt` | simbad.harvard.edu | 88419 | `eea398b658a29fad9cce47975c24855fc569a330fdd5d92d6158fb21eef0dd7c` |
