# Fuentes de `data/raw/red`

Respuestas de servicios externos guardadas tal cual por `scripts/catalog/red.js` (`npm run descargar:red`, con `HOSHI_RED=descargar`). Descarga hecha desde el Mac de Sergio el 07/11/2026 (las horas del índice están en UTC). `npm run catalogo` las reutiliza sin red: cada consulta se guarda en `<paso>/<huella>.txt`, donde la huella es el sha1 de la URL y del cuerpo de la consulta, y `<paso>/indice.json` trae la URL, la fecha, el tamaño y el sha256 de cada respuesta.

Las consultas que fallaron al descargar se guardan como error y se repiten igual sin red (el paso omite lo mismo que omitió al descargar).

Licencias y condiciones de uso: las de cada servicio (SIMBAD/CDS, NASA Exoplanet Archive, MAST, Gaia/ESA, JMMC), citadas en el encabezado de cada paso.

## `espectros` — `scripts/catalog/build_espectros_simbad.js`

Servicio: SIMBAD (CDS), TAP. Consultas: 2 (0 con error). Descarga: 2026-11-08T00:04:58Z – 2026-11-08T00:04:59Z. Total: 2256667 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `49724523bc4ca6cb50688e1f0ea6e34c7c4c3579.txt` | simbad.harvard.edu | 2170709 | `2f0702eb3e52dd1034c77ecf578d8968df013f59be92bb8b662d43739989e638` |
| `acf7bc0adde16ccd0f909174a428ab85499ddaec.txt` | simbad.harvard.edu | 85958 | `613643ff58fdab6113f47b28d2dea5159743495d8ed4efdea03b7dfb4104eb90` |

## `gaia_simbad` — `scripts/catalog/build_gaia_simbad.js`

Servicio: SIMBAD (CDS), TAP. Consultas: 2 (0 con error). Descarga: 2026-11-08T00:05:53Z – 2026-11-08T00:05:53Z. Total: 7313 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `29c31de231f31bb6f0568f83ea36b1a69bdb411c.txt` | simbad.harvard.edu | 3925 | `883f0bd3449998600ec25113b073ef1bdb610d861d280cb1de74efc59bec3559` |
| `310936447762ad18503815fb0863cde52417da58.txt` | simbad.harvard.edu | 3388 | `0e972a91dec9a6d5e66a0a5181a383beb2c610ff11a44d7cdafc117e824b1ee9` |

## `jmdc` — `scripts/catalog/build_jmdc.js`

Servicio: JMDC (JMMC), página http://jmdc.jmmc.fr/. Consultas: 1 (0 con error). Descarga: 2026-11-08T00:05:59Z – 2026-11-08T00:05:59Z. Total: 1835612 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `06ea65e8ef33efda2460d9031a5183b8d9c39a03.txt` | jmdc.jmmc.fr | 1835612 | `e3f8bbaf3ec95ee71692ecc8bca002dc003583c980c27450e15c8da7a41fdc9d` |

## `alias` — `scripts/process_star_aliases.js`

Servicio: SIMBAD (CDS), TAP. Consultas: 2 (0 con error). Descarga: 2026-11-08T00:06:02Z – 2026-11-08T00:06:05Z. Total: 3398863 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `452679c174cced581c487d2dd4116e5b87fc3897.txt` | simbad.harvard.edu | 173373 | `8dccb55ad8846f0702fa611719d654603c8ef29ca730a17056d511e59f701a64` |
| `10393dd6686ebc183880dcd3f820d6b95e2f0e6a.txt` | simbad.harvard.edu | 3225490 | `811cca037a533a5bf291d3becb8af66ccee0714a3882647ec7d4ab485e458491` |

## `oficiales` — `scripts/process_stellar_official.js`

Servicio: NASA Exoplanet Archive, MAST (TIC v8.2), SIMBAD y Gaia DR3 (ARI Heidelberg). Consultas: 59 (9 con error: tiempo agotado en MAST). Descarga: 2026-11-08T00:12:49Z – 2026-11-08T00:22:44Z. Total: 1383576 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `6f5b79b13199aa021edb6118cd7d31905061be82.txt` | exoplanetarchive.ipac.caltech.edu | 45557 | `afb0ceb964962a1e1a340e16e3d347d26b8a854b9af825588fb6b6e0340f8458` |
| `05a6bf6f19c6c44d7f928f782c59ae530ca74357.txt` | mast.stsci.edu | 340074 | `bfa260afd56e67645460926b154b1dafc2beb73ad11bab65d3ebcb79b41b2aae` |
| `1d76c01eb7d63ccdf3f4e850ed851b49904d8cbd.txt` | mast.stsci.edu | 316190 | `53089124500573cb6d2bde9f2acfd395f7d5c4f4304f4463b1f84b6a95ac4392` |
| `0cb8db94e37c31efd0d4e64918d67b64ae1fa30b.txt` | mast.stsci.edu | 292375 | `0932b6bbddfde9957b84d39f7cbaaf305e83cdd763d8f155bed3132de4761aee` |
| `71eb034c2a3ac5f707c6c2a7ba4d52ae15a8e9c2.txt` | simbad.harvard.edu | 3118 | `b8e86c57ca64d5939201244ed8101efed0df7378319fa3e22610b4c54baf6ac7` |
| `5a049396432e221ed6e0f6708c4fb6609caee4b1.txt` | simbad.harvard.edu | 155981 | `037b8e4cc9dff792bf72714b780b8711a5bb8b356d1738d187f096c34ddafcab` |
| `6efd3833e6dd6b46869191be16922055beea17fa.txt` | simbad.harvard.edu | 3693 | `70c11f18bc4909ee8aa4fcfe5008fa448026aa0b41afe7c03adf3b993fa479c4` |
| `66aceb3676ea3eadb5bed55dc5d0115d1ca26ae6.txt` | simbad.harvard.edu | 3214 | `ef7e80742c95269cdce5c217a35f2097f2c913a9faafd7acc5c458d3486f3437` |
| `cc87f5558f4da98c942a7f11263d35b64a7846fa.txt` | simbad.harvard.edu | 75621 | `0501e7a18953a333c2288b0d0aa7885de84cc7f479a12a1d82abbee21770f97b` |
| `a174b3d8f47e40c62d149f0cdc069ec3c419fe49.txt` | simbad.harvard.edu | 3518 | `bf31f065d955209523e80e3d48e4d59d1bdeedf2e968760cb436f12d4f58cc3d` |
| `1a42c72e2d680f8b2668a444ecbfca2de71b604b.txt` | simbad.harvard.edu | 3167 | `8d36735e7baf787bcde1e012ac8cf0d328d6086ec867a45b9b2ac4cb3127f5de` |
| `6ed511f414eddf3eea9b407126b8bd95c5e69154.txt` | simbad.harvard.edu | 44432 | `99bbc0577e27b67d1f146525086d75c22d13bf2eef251132b55f4eff22ea8542` |
| `1680fbe248a093fc70400e8c73820600d6d24485.txt` | simbad.harvard.edu | 2571 | `8f51b59ef37c758c9b8b443b7734c5573a2efa0daeb4eb3e1afc6a9912af85fe` |
| `e2d827e9bed6e29b743ccf0103e9e0a113c3424c.txt` | simbad.harvard.edu | 1560 | `a27ae814b74cc403470e9c8755c82006f3255edd7bd6e838d40bad4e9743b322` |
| `ba77d6823f72fec8aabc7cd7bf5c4ceee4f0391b.txt` | simbad.harvard.edu | 1703 | `74bfc5085bdc9165917da2ba2afd7b7937ab61a37a1b07237d31cdac328ac100` |
| `3141c4345510a68a261a5bab72307c87eafed53a.txt` | simbad.harvard.edu | 1601 | `68c6ba0a068450e00881ce49c05ebc3a30eaafbb25af5fea294ce6ace3218bce` |
| `61fb92206aa645034ec0d6caa080b0192f52f34a.txt` | simbad.harvard.edu | 1792 | `d4aeca7461e14e92156f5299574caa5ef44ffd919c78f303be48c5c2b8cd5cf9` |
| `1211e7f2410940aaf0b82d32c51931243b72f025.txt` | simbad.harvard.edu | 1841 | `55458cad0ed8c12392758ad62a451dad54a0864cea5d423f235f2d2c64ddb632` |
| `79850dd3f9ba83b7e702e8597eb483c69e63d6f3.txt` | simbad.harvard.edu | 1951 | `b467c270a365998183122c56bb0d56c86d8981840942ee6d9bd65abab347203a` |
| `e22593435e079d3ee7029668169d53ce40985af1.txt` | simbad.harvard.edu | 1388 | `e978a303e86ffef25b701677fe59163e9546aade982f011f80d6712d9b89e533` |
| `8832c633a04aeda087dcc5a5fb1b89e65fd7ee0b.txt` | simbad.harvard.edu | 2117 | `68a36f172c7897c252cf05bb1a7db19e252cb3ebf9d72d0b591aa15b2c0dd1d2` |
| `d6b562ab57ddf013dacba40a7768c05485265c7f.txt` | simbad.harvard.edu | 1654 | `da9fb34751bd6283dc630127acd0cde33fc006742627cca6b6298a8dd9ba8c0e` |
| `51d6633a5f62675d24be24e9981f6da098c3f3d0.txt` | simbad.harvard.edu | 1766 | `42381de46cb35840846cc45e185b76f39e591de422b5e26d1e9b35d7160d9224` |
| `dcd92c668f1125df253b6ec31761227a2e142d12.txt` | simbad.harvard.edu | 1842 | `38880e30770810b0d64f3c231ad921e0439cde285780b2d23bfaba732b4a4f65` |
| `d1f9b6a078e3c58b727593bca2bbc1aaff639673.txt` | simbad.harvard.edu | 1891 | `91e7483473dbecb21b764b057583b1d5b3b5659c8ec0314699221bf23caf3b3c` |
| `fe36cb3d8dbcf265ac5762286cd7e5752ff442fd.txt` | simbad.harvard.edu | 2058 | `380fb4816bc8ca14bad80dfd1aada46170a43cc366ea14e6b3f4ba39be191569` |
| `dc46d6616ca58ab7dcb407733a9d082a6a732783.txt` | simbad.harvard.edu | 1950 | `daae18e93aba29d3e2d09ee8eb5b50912e94bcb00cdc0bd4b57483a10d207a60` |
| `854b55786a102d50a91e68fc27b7bfb361517e19.txt` | simbad.harvard.edu | 1719 | `28cbfb5d316da352e15ec4d06972c1563add0c018c3490307ade37ffb82cb888` |
| `ce0d29683e40da1b2f5bea38f2b48e7b7d1ebf91.txt` | simbad.harvard.edu | 1822 | `00c6327ab60d5452032401bc82b20c4fe52ba7715132d42119610feca426f376` |
| `8846e5cf6c6daaeaa6d93f38bb920ff56ba8f992.txt` | simbad.harvard.edu | 1894 | `b1c25318a4aaa0e33d9c7a4ffa001df0a737d91544d188c94c39bff8e5078b34` |
| `e124f86932d40c3cce78b1d5412a669da93517ac.txt` | simbad.harvard.edu | 1761 | `9b312c529cdea6f79184757a35be4fa83fe443c2438b0e5b3d771084137c1d2d` |
| `4392657c5df65ef319e24349c8a0d4e56d808ca4.txt` | simbad.harvard.edu | 2154 | `fb47011e5e012467ee027fe028be37a1c89601d8f2ef1934b3190da8ff685bc0` |
| `5ec3807639ff79bde71103e26e8f7f6c1e0a3cf0.txt` | simbad.harvard.edu | 1776 | `167a73b7b72926a790c35ec611b8fd8e8b08f133515b0f0754e09252b7e8ad05` |
| `939c32419f27509df1419059609ec0b675694310.txt` | simbad.harvard.edu | 2227 | `c7e11efa2f3c52e91a9abe7d33e1e2e11e7487f9111683043e507310f42c6333` |
| `71383c0e6e25605ac3b47f526f92dd27d18de991.txt` | simbad.harvard.edu | 2431 | `a49f8e46ab6d918f14173dcbd6cdb134c6d8478d011367f2d8b12159369c3025` |
| `7ddd36c420851ec6a14fe517c3c197b22b252e04.txt` | simbad.harvard.edu | 1995 | `47ea3153063b45a2122aecbe8239bd04f1ec63513e4d4e4ab4964889c294f0b6` |
| `cd5c540f73a69bf65eb921d85f31222a6f7bad56.txt` | simbad.harvard.edu | 2308 | `4c9823230824da6c347c7053124ebfaf6f4dcd3704363b6e2fe00910b7e6b14c` |
| `eaf372070a8f7e52d2ad10b9301b359259c97752.txt` | simbad.harvard.edu | 2137 | `d82cc643675fde72690435f0a8b734b3a69cca40c4a9ad0d55bf78b65a6d7c22` |
| `2af8574ea9cb082c24a8c339a102dee615ed1140.txt` | simbad.harvard.edu | 1986 | `d6d6265cf60f1e39e23e8e1eb048cc1a6c17c66fa984a813228ce6772afe92b5` |
| `3cdc65daf182ba33444f6f8feda1dd205da16f2e.txt` | simbad.harvard.edu | 2033 | `d7a910d9fb75e1f9bb8f976b2dd886911f0e950a6cef3518e441e02345d74ba0` |
| `2e8a858e82a39db8e25c3dd005c27c22877d9342.txt` | simbad.harvard.edu | 2006 | `b2d84e654b8d4a5de2dc0d1a6e2a5311f3e7cff82c864e9c98cba952615ebe81` |
| `0819166d57b1c53ceef183eddf7745c8946d4dbd.txt` | simbad.harvard.edu | 2099 | `1503708e819eb27ab8a6eb1f5b065836259b5fdafffc66aacbfcc6a1fa66cad4` |
| `34862b53aa5735f75422b9e9c668cd4fd6cbd9ad.txt` | simbad.harvard.edu | 1346 | `b72273036a5db2f5b3ed8fdd04c28f814cf9c1942e0dd99361ec7ea6ed127687` |
| `802d157be3446da5999701d6a25ffaae8823bb0c.txt` | simbad.harvard.edu | 1683 | `c79975b9060e9ee02c1d6690a0bce9f0dbdc3321559132b18b5907a4b85d278a` |
| `6502c9033c3f13af3740c2c0368ff91a3e0b954f.txt` | simbad.harvard.edu | 2075 | `8d51d789cd3e221381e199596238374a90d85c196c79a21b9e5300ce9304e00f` |
| `61f6f095bfbd59b0c6f01e78c5764c00e697a5f8.txt` | simbad.harvard.edu | 1862 | `8ec181304ba928c75458fef41067760d777f8c1f186239d363affc2a36c25721` |
| `ba700b16446c70a486155f34f96036d880feb4a2.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `43e69b5351be59b75e748ad612792201ac74de51.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `6e8b371296b824539e62b1e64ca94e8836cb704c.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `df31fe1a63c9e2459678fc04077f5ca58874c659.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `05aed10175308923c7bcfd8e526d1efc9e1928d3.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `983ac6d068bc64e3cc7e5bb52b9510fee16d174c.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `e0b56d50bbc1136705155d78e80bca51b0888f54.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `42e251da8de8b30b699279f0c55e2ece9450b477.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `0c066ef57f2ded6441edb51cff27f072f410e04c.txt` | mast.stsci.edu (error) | 46 | `23f6c278b4e002b89598d292f97d47b07c08615781d06271fa9911b585b87a4a` |
| `0507a382662096ff170421dd559a0ac2545cff0f.txt` | gaia.ari.uni-heidelberg.de | 12391 | `59c9d98266d565c50282038531691de1ba1934f18fb65fb54196fdbe99e4815c` |
| `c285d4767caf78990ef06c6325009ec7107ca57f.txt` | gaia.ari.uni-heidelberg.de | 12528 | `530d17785f905fa0e2be424e05ea53f400c2eef134dfa1f9cd7215134a0bad43` |
| `17cfb88ffd4da453e49b3128ac958f6886436034.txt` | gaia.ari.uni-heidelberg.de | 6012 | `6bdf7a142d522c934fd10701ec2cf7fe39d132e02becafb80009533b1497c4ac` |
| `b03381601401b51299a872d8e061f75daf5c49d8.txt` | gaia.ari.uni-heidelberg.de | 292 | `921eaad0a4b5cdd9c2e1c0b7aa972b4672fb07734e054faac22dc80ec563b3f9` |

## `fichas` — `scripts/process_fichas.js`

Servicio: NASA Exoplanet Archive, SIMBAD y Gaia DR3 (ESA). Consultas: 8 (0 con error). Descarga: 2026-11-08T00:23:40Z – 2026-11-08T00:23:58Z. Total: 1696760 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `971be7cdae1e2058986f3a80ae0e4774980f6981.txt` | exoplanetarchive.ipac.caltech.edu | 1638549 | `0864259375045df30a863d8bd38c87fec608f5007b2e6edc3b1c9e30f959272f` |
| `79e22481eaf798a00630da3c65f9b8386ec20d4f.txt` | simbad.harvard.edu | 4938 | `2b1b04dfca5ae18cf8eb1c1fb568eb40abdf4b57836401a6b5118d28ef78dbe9` |
| `fd50f5263a9829fd6157113435cdd984da791f1b.txt` | simbad.harvard.edu | 5408 | `32a4d79a270eb43d0980b205ffea92ae182522e3f8a7cadf555c5b4442ce7539` |
| `be100845f8660ac9db2d65d255f4a797036fec21.txt` | simbad.harvard.edu | 5054 | `b338e66d89adc5d8459dbcc781c3803fa5a89947eeb12d782d761e26126b2bdb` |
| `27960e818a7ccd977eaa562273c601ba455b3266.txt` | gea.esac.esa.int | 6779 | `f52a69534b6386513e7a58cf60c4ab35a66040bd11ad74fe148dacf3a3cc2a7f` |
| `e107715776c611a899a5b13ee9df7e63fdccd068.txt` | gea.esac.esa.int | 17068 | `2bf6c141bf0d0693cfcc30cd67f461a23f4c4efe693f2e8e444eaffaaae31f09` |
| `b0438b2f83e17d7f84979437e7a6c56bf7cd2429.txt` | gea.esac.esa.int | 13622 | `f49f23fbae7a1a0f896717f34a2dfb99a397b17b9c58228e578dfd17b32273ee` |
| `423478825c4881d3ba8791b2662c9168bdc028d1.txt` | gea.esac.esa.int | 5342 | `2244b64f552b66517c580ffa152ccb01310a818d9cedab5112d61af202339636` |

## `cumulos` — `scripts/process_cumulos.js`

Servicio: SIMBAD (CDS), TAP. Consultas: 1 (0 con error). Descarga: 2026-11-08T00:24:08Z – 2026-11-08T00:24:08Z. Total: 88419 bytes.

| Archivo | Servicio | Bytes | sha256 |
| --- | --- | ---: | --- |
| `75c4b7932e198571ea044de22cc50a3c5f58546e.txt` | simbad.harvard.edu | 88419 | `eea398b658a29fad9cce47975c24855fc569a330fdd5d92d6158fb21eef0dd7c` |
