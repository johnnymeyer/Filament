import * as Filament from "filament";

namespace SketchRenderAPI {


    class PlatformBase {
        private _type: string = this.constructor.name; //Only here for debugging 
    }

    function getObjMgr(): FilamentObjectManager {
        return ((window as any).FilamentObjectManager as FilamentObjectManager);
    }

    function getObj(id: ObjID): PlatformBase {
        return getObjMgr().get(id);
    }

    function addObj(obj: any): ObjID {
        return getObjMgr().add(obj);
    }

    function hasObj(id: ObjID): boolean {
        return getObjMgr().has(id);
    }

    function removeObj(id: ObjID) {
        getObjMgr().remove(id);
    }


    class FilamentUnits {

        public static readonly SKETCH_UNITS_TO_FILAMENT_UNITS: number = 1.0 / 5000.0;

        public static SKETCH_COORDS_TO_FILAMENT_COORDS_MAT: Filament.mat3 = [
            1, 0, 0,
            0, 0, 1,
            0, -1, 0
        ];

        public static convertFloatSktToFil(sktVal: number): number {
            return sktVal * this.SKETCH_UNITS_TO_FILAMENT_UNITS;
        }

        public static convertPtSktToFil(sktPt: number[]): number[] {
            return [
                this.convertFloatSktToFil(sktPt[0]),
                this.convertFloatSktToFil(sktPt[1]),
                this.convertFloatSktToFil(sktPt[2])
            ];
        }

        public static convertVec3SktToFil(sktPt: number[]): Filament.float3 {
            return [
                this.convertFloatSktToFil(sktPt[0]),
                this.convertFloatSktToFil(sktPt[1]),
                this.convertFloatSktToFil(sktPt[2])
            ];
        }

        public static convertMatSktToFil(sktMat: number[][]): number[][] {
            var conv = []
            for (var row = 0; row < sktMat.length; row++) {
                conv.push([]);
                for (var col = 0; col < sktMat[row].length; col++) {
                    conv[row][col] = this.convertFloatSktToFil(sktMat[row][col]);
                }
            }
            return conv;
        }
    }

    enum EntityID {
        ENTID_NULL = 0,
    }

    class PlatformEntityManager {

        private _entityMap: Map<EntityID, Filament.Entity>;
        private _idManager: IdManager;

        public constructor() {
            this._entityMap = new Map<EntityID, Filament.Entity>();
            this._idManager = new IdManager();
        }

        public createEntity(): EntityID {
            const newEntity = Filament.EntityManager.get().create();
            const id = this._idManager.getId() as EntityID;
            this._entityMap.set(id, newEntity);
            return id;
        }

        public destroy(id: EntityID) {

            if (!this._entityMap.has(id)) {
                return false;
            }
            //We don't have access to .destroy()
            //const entity = this._entityMap.get(id);
            //Filament.EntityManager.get().destroy(entity);
            this._entityMap.delete(id);
        }

        public hasEntity(id: EntityID): boolean {
            return this._entityMap.has(id);
        }

        public getEntity(id: EntityID): Filament.Entity {
            if (this.hasEntity(id)) {
                return this._entityMap.get(id);
            }
            else {
                return null;
            }
        }
    }

    //We don't have access to the Entity.getId so this is here to replicate the functionality
    //Also used to track objects on the JS side
    class IdManager {

        private _id: number;

        public constructor() {
            this._id = 0;
        }

        public getId() {
            this._id += 1;
            return this._id;
        }

        public clear() {
            this._id = 0;
        }
    }

    class PlatformCamera extends PlatformBase {

        readonly ONE_METER: number = 5000.0;
        readonly DEFAULT_FOV: number = 45.0;
        readonly DEFAULT_ASPECT_RATIO: number = 16.0 / 9.0;
        readonly DEFAULT_NEAR_PLANE: number = this.ONE_METER * 0.05;
        readonly DEFAULT_FAR_PLANE: number = this.ONE_METER * 1000.0;

        private _camera: Filament.Camera;

        public constructor(camera) {
            super();
            this._camera = camera;
            this.initialize();
        }

        public initialize() {
            this.setProjection(this.DEFAULT_FOV, this.DEFAULT_ASPECT_RATIO, this.DEFAULT_NEAR_PLANE, this.DEFAULT_FAR_PLANE);
            const pos = [0, 0, this.ONE_METER];
            const lookPos = [0, this.ONE_METER, this.ONE_METER];
            const upVec = [0, 0, 1.0];
            this.lookAt(pos, lookPos, upVec);
        }

        public lookAt(sktEye: number[], sktCenter: number[], sktUp: number[]) {
            const eye = FilamentUnits.convertPtSktToFil(sktEye);
            const center = FilamentUnits.convertPtSktToFil(sktCenter);
            this._camera.lookAt(eye, center, sktUp);
        }

        public setProjection(fovInDegrees: number, aspect: number, near: number, far: number) {
            this._camera.setProjectionFov(fovInDegrees, aspect, FilamentUnits.convertFloatSktToFil(near), FilamentUnits.convertFloatSktToFil(far), Filament.Camera$Fov.VERTICAL);
        }

        public setModelMatrix(sktMat: number[][]) {
            //TODO: Maybe switch to using gl-matrix library instead of number[][]
            var modelMat = [
                [1, 0, 0, 0],
                [0, 1, 0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1]
            ];

            // Copy most of the matrix components
            for (var row = 0; row < 3; ++row) {
                for (var col = 0; col < 4; ++col) {
                    var matVal = sktMat[row][col];
                    modelMat[row][col] = matVal;
                }
            }

            // Convert the positions as we copy them
            var sktPos = [sktMat[3][0], sktMat[3][1], sktMat[3][2]];
            var convPos = FilamentUnits.convertPtSktToFil(sktPos);// convert this way, rather than per-component to allow coordinate system conversion to happen
            modelMat[3][0] = convPos[0];
            modelMat[3][1] = convPos[1];
            modelMat[3][2] = convPos[2];

            // Copy the last value directly
            modelMat[3][3] = sktMat[3][3];

            // Flattens the 2d array into a single array which filament expects
            var flattened = modelMat.reduce((acc, val) => acc.concat(val), []);
            this._camera.setModelMatrix(flattened);
        }

        public getCamera(): Filament.Camera { return this._camera; }
    }

    class PlatformRenderContext extends PlatformBase {

        private _swapChain: Filament.SwapChain;
        private _renderer: Filament.Renderer;

        public constructor(swapChain: Filament.SwapChain, renderer: Filament.Renderer) {
            super();
            this._swapChain = swapChain;
            this._renderer = renderer;
            this._render = this._render.bind(this);
        }

        public renderByID(platViewID: ObjID) {
            var platView = getObj(platViewID) as PlatformView;
            if (platView == null) {
                return;
            }
            this.render(platView.getView());
        }

        private _tempView: Filament.View;
        public render(view: Filament.View) {
            this._tempView = view;
            //window.requestAnimationFrame(this._render); //TODO: Make sure this is necessary
            this._render();
        }

        private _render() {
            this._renderer.render(this._swapChain, this._tempView);
        }

        public getSwapChain(): Filament.SwapChain { return this._swapChain; }
        public getRenderer(): Filament.Renderer { return this._renderer; }
    }

    class PlatformScene extends PlatformBase {

        private _scene: Filament.Scene;

        public constructor(scene) {
            super();
            this._scene = scene;
        }

        public getScene(): Filament.Scene { return this._scene; }
    }

    enum IndirectLightType {
        INDLIGHT_NOONGRASS = 0,
        INDLIGHT_DEFAULT_SKY,
        INDLIGHT_NUM_STANDARD_INDIRECT_LIGHTS
    }

    class PlatformIndirectLight extends PlatformBase {

        private _indrectLight: Filament.IndirectLight;
        private _indirectLightType: IndirectLightType;

        public constructor(indirectLight: Filament.IndirectLight, indirectLightType: IndirectLightType) {
            super();
            this._indrectLight = indirectLight;
            this._indirectLightType = indirectLightType;
        }

        public getIndirectLight(): Filament.IndirectLight { return this._indrectLight; }
        public getIndirectLightType(): IndirectLightType { return this._indirectLightType; }

        public setIntensity(intensity: number) {
            this._indrectLight.setIntensity(intensity);
        }

        public static getCoefficients(indirectLightType: number): number[][] {
            switch (indirectLightType) {
                case 0:
                    return this.noonGrassCoef;
                case 1:
                    return this.defaultSky;
                default:
                    alert("Unknown light type specified!");
                    return null;
            }
        }

        private static noonGrassCoef: number[][] = [
            [0.623220127315220, 0.886922625176132, 1.255084767605070], // L00
            [-0.210521732019477, -0.270994631349530, -1.099017699677069], // L1-1
            [0.031589825992246, 0.058418596454591, 0.159860525707438], // L10
            [-0.002709596838855, 0.015904246634819, 0.028695913735464], // L11
            [0.016667782987820, 0.026230409311113, 0.010163630191357], // L2-2
            [-0.040963502607874, -0.050351523406741, -0.101756407860318], // L2-1
            [-0.136296161919919, -0.140777720274997, -0.183877580383222], // L20
            [-0.034435148087843, -0.051731329734875, -0.113001255527486], // L21
            [-0.294609334103497, -0.345042383380244, -0.550035456175430] // L22
        ];

        private static defaultSky: number[][] = [
            [0.350047290325165, 0.350047290325165, 0.350047290325165], // L00, irradiance, pre-scaled base
            [0.155069604516029, 0.155069604516029, 0.155069604516029], // L1-1, irradiance, pre-scaled base
            [0.045930672436953, 0.045930672436953, 0.045930672436953], // L10, irradiance, pre-scaled base
            [-0.045964866876602, -0.045964866876602, -0.045964866876602], // L11, irradiance, pre-scaled base
            [-0.038627006113529, -0.038627006113529, -0.038627006113529], // L2-2, irradiance, pre-scaled base
            [0.038441505283117, 0.038441505283117, 0.038441505283117], // L2-1, irradiance, pre-scaled base
            [0.010158680379391, 0.010158680379391, 0.010158680379391], // L20, irradiance, pre-scaled base
            [-0.026496363803744, -0.026496363803744, -0.026496363803744], // L21, irradiance, pre-scaled base
            [0.030545882880688, 0.030545882880688, 0.030545882880688], // L22, irradiance, pre-scaled base
        ];

        public static buildCubemap(engine: Filament.Engine, lightType: IndirectLightType, cubemap: PlatformTexture): Filament.IndirectLight {

            return new Filament.IndirectLight$Builder()
                .reflections(cubemap.getTexture())
                .irradianceSh(3, this.getCoefficients(lightType))
                .build(engine);
        }

        public static build(engine: Filament.Engine, lightType: IndirectLightType): Filament.IndirectLight {

            var light = new Filament.IndirectLight();
            var sh = this.getCoefficients(lightType);
            var flattened = sh.reduce((acc, val) => acc.concat(val), []);
            light.shfloats = flattened;
            return light;
        }
    }

    class PlatformLight extends PlatformBase {

        private _lightType: Filament.LightManager$Type;
        private _entityID: EntityID;

        public constructor(lightType, entityID) {
            super();
            this._lightType = lightType;
            this._entityID = entityID;
        }

        public getLightType(): Filament.LightManager$Type { return this._lightType; }
        public getEntityID(): EntityID { return this._entityID; }
    }

    class PlatformView extends PlatformBase {

        private _view: Filament.View;
        private _canvas: HTMLCanvasElement;
        private _camera: PlatformCamera;
        private _scene: PlatformScene;
        private _viewport: PlatformViewport;

        public constructor(view: Filament.View, canvas: HTMLCanvasElement) {
            super();
            this._view = view;
            this._canvas = canvas;
        }

        public getView(): Filament.View { return this._view; }

        public setCamera(camera: PlatformCamera) {
            this._camera = camera;
            this._view.setCamera(this._camera.getCamera());
        }
        public setCameraByID(platCameraID: ObjID) {
            var platCamera = getObj(platCameraID) as PlatformCamera;
            if (platCamera == null) {
                return;
            }
            this.setCamera(platCamera);
        }
        public getCamera(): PlatformCamera { return this._camera; }

        public setScene(scene: PlatformScene) {
            this._scene = scene;
            this._view.setScene(this._scene.getScene());
        }
        public setSceneByID(platSceneID: ObjID) {
            var platScene = getObj(platSceneID) as PlatformScene;
            if (platScene == null) {
                return;
            }
            this.setScene(platScene);
        }
        public getScene(): PlatformScene { return this._scene; }

        public setViewport(viewport: PlatformViewport) {
            this._viewport = viewport;
            this._canvas.width = viewport.getWidth();
            this._canvas.height = viewport.getHeight();
            this._view.setViewport(viewport.getViewport());
        }

        public setViewportByID(platViewportID: ObjID) {
            var platViewport = getObj(platViewportID) as PlatformViewport;
            if (platViewport == null) {
                return;
            }
            this.setViewport(platViewport);
        }
        public getViewport(): PlatformViewport { return this._viewport; }

    }

    class PlatformMeshSubGeometry extends PlatformBase {
        private _primType: Filament.RenderableManager$PrimitiveType;
        private _indexOffset: number;
        private _indexCount: number;
        private _materialInstance: PlatformMaterialInstance;

        public constructor(primType: Filament.RenderableManager$PrimitiveType, indexOffset: number, indexCount: number, materialInstance: PlatformMaterialInstance) {
            super();
            this._primType = primType;
            this._indexOffset = indexOffset;
            this._indexCount = indexCount;
            this._materialInstance = materialInstance;
        }

        public getPrimType(): Filament.RenderableManager$PrimitiveType { return this._primType; }
        public getIndexOffset(): number { return this._indexOffset; }
        public getIndexCount(): number { return this._indexCount; }
        public getMaterialInstance(): PlatformMaterialInstance { return this._materialInstance; }
    }

    enum CompressionType {
        UNKNOWN = 0,
        NONE,
        BC1,			// BC1 format (DXT1)						- XYZ1	R5:G6:B5:A1 bits
        BC1N,			// BC1 normal map format (DXT1nm)
        BC1A,			// BC1 format with binary alpha (DXT1a)
        BC2,			// BC2 format (DXT3)						- XYZA	R5:G6:B5:A4 - Use for low-coherent alpha data
        BC3,			// BC3 format (DXT5)						- XYZA	R5:G6:B5:A3 - Use for highly-coherent alpha data
        BC3N,			// BC3 normal map format (DXT5nm)			- _Y_X  Two component - Encoded to use Capcom's DXT decompression trick
        BC4,			// BC4 format (ATI1)						- X___	Single component - Ideal for floating point in [0, 1] or [-1, 1] range, can also store alpha?
        BC5,			// BC5 format (ATI2 / 3Dc / DXN)			- XY__  R8:G8 - Two component, usually for normal maps
    }

    enum TextureType {
        TEX_UNKNOWN = 0,
        TEX_COLOR,						// Color / albedo map (sRGB space)
        TEX_COLOR_LUT,					// Color look up table (linear space data)
        TEX_NORMAL,						// Normal map
        TEX_ROUGHNESS,					// Roughness / glossiness map
        TEX_METAL,						// Metal / dialectric
        TEX_AO,							// Ambient occlusion
        TEX_REFLECTION,					// Reflection map
        TEX_DISPLACEMENT,				// Displacement map
        TEX_CUBEMAP,					// Cube map
    }

    class TextureBuildInfo {
        isInitialized: boolean = false;
        texture: Filament.Texture = null;
        width: number = 0;
        height: number = 0;
        depth: number = 0;
        pixelDataType: Filament.CompressedPixelDataType = Filament.CompressedPixelDataType.DXT1_RGB; //TODO: This probably isn't correct for web??
        internFormat: Filament.Texture$InternalFormat = Filament.Texture$InternalFormat.DXT1_RGB; //TODO: This probably ins't correct for web??
        numMipMaps: number = 0;
        texType: TextureType = TextureType.TEX_UNKNOWN;
        compressionType: CompressionType = CompressionType.UNKNOWN;
    }

    class PlatformTexture extends PlatformBase {

        _texInfo: TextureBuildInfo;
        _texType: TextureType;
        _width: number;
        _height: number;

        public constructor(texInfo: TextureBuildInfo) {
            super();
            this._width = texInfo.width;
            this._height = texInfo.height;
            this._texType = texInfo.texType;
            this._texInfo = texInfo;
        }

        public getTexture(): Filament.Texture { return this._texInfo.texture; }

        public destroy(engine: Filament.Engine) {
            if (this._texInfo.texture == null) {
                return;
            }
            engine.destroyTexture(this._texInfo.texture);
            delete this._texInfo;
        }

        public static build() {
            //TODO: Implement these build functions
        }

    }

    enum MaterialType {
        MTL_DEFAULT = 0,
        MTL_UNLIT_COLOR,
        MTL_UNLIT_COLOR_ALPHA,
        MTL_UNLIT_FONT,
        MTL_UNLIT_FONT_OUTLINE,
        MTL_UNLIT_VERTEX_COLOR,
        MTL_LIT_SIMPLE,
        MTL_LIT_TEXTURED,
        MTL_UI_ICON,
        MTL_NUM_STANDARD_MATERIALS,		// First custom material identifier begins at this value
    }

    class PlatformMaterialInstance extends PlatformBase {

        private _materialInstance: Filament.MaterialInstance;
        private _isInitialized: boolean = false;

        protected readonly PARAM_ALBEDO: string = "albedo";
        protected readonly PARAM_AMBIENT_OCCLUSION = "ao";
        protected readonly PARAM_BASE_COLOR = "baseColor";
        protected readonly PARAM_METALLIC = "metallic";
        protected readonly PARAM_NORMAL = "normal";
        protected readonly PARAM_ROUGHNESS = "roughness";
        protected readonly PARAM_REFLECTANCE = "reflectance";
        protected readonly PARAM_COLOR_LUT = "color_lut";
        protected readonly PARAM_CLIP_SPACE_TRANSFORM = "clipSpaceTransform";

        constructor(materialInstance: Filament.MaterialInstance) {
            super();
            this._materialInstance = materialInstance;
        }

        public getMaterialInstance(): Filament.MaterialInstance { return this._materialInstance; }

        public getIsInitialized(): boolean { return this._isInitialized; }
        public setIsInitialized(value: boolean) { this._isInitialized = value; }

        public setTextureParam(paramName: string, tex: PlatformTexture, sampler: Filament.TextureSampler) {
            var filTex = tex.getTexture();
            this._materialInstance.setTextureParameter(paramName, filTex, sampler);
        }

        public albedoTexByID(platTexID: number, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var platTex = getObj(platTexID) as PlatformTexture;
            if (platTex == null) {
                return;
            }
            this.albedoTex(platTex, wrapMode, minFilter, magFilter);
        }

        public albedoTex(platTex: PlatformTexture, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var sampler = new Filament.TextureSampler(minFilter, magFilter, wrapMode);
            this.setTextureParam(this.PARAM_ALBEDO, platTex, sampler);
        }

        public ambientOcclusionTexByID(platTexID: number, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var platTex = getObj(platTexID) as PlatformTexture;
            if (platTex == null) {
                return;
            }
            this.ambientOcclusionTex(platTex, wrapMode, minFilter, magFilter);
        }

        public ambientOcclusionTex(platTex: PlatformTexture, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var sampler = new Filament.TextureSampler(minFilter, magFilter, wrapMode);
            this.setTextureParam(this.PARAM_AMBIENT_OCCLUSION, platTex, sampler);
        }

        public baseColor(r: number, g: number, b: number, a: number) {
            this._materialInstance.setColor4Parameter(this.PARAM_BASE_COLOR, Filament.RgbaType.sRGB, [r / 255, g / 255, b / 255, a / 255]);
        }

        public baseColorLinear(r: number, g: number, b: number, a: number) {
            this._materialInstance.setColor4Parameter(this.PARAM_BASE_COLOR, Filament.RgbaType.LINEAR, [r / 255, g / 255, b / 255, a / 255]);
        }

        //TODO: Might not need this for web
        private convertParamName(paramName: string): string {
            return paramName + "\0"; //null terminate
        }

        public setColor(paramName: string, r: number, g: number, b: number, a: number) {
            var param = this.convertParamName(paramName);
            if (param == null) {
                return;
            }
            this._materialInstance.setColor4Parameter(param, Filament.RgbaType.sRGB, [r / 255, g / 255, b / 255, a / 255]);
        }

        public setColorLinear(paramName: string, r: number, g: number, b: number, a: number) {
            var param = this.convertParamName(paramName);
            if (param == null) {
                return;
            }
            this._materialInstance.setColor4Parameter(param, Filament.RgbaType.LINEAR, [r / 255, g / 255, b / 255, a / 255]);
        }

        public metallic(metal: number) {
            this._materialInstance.setFloatParameter(this.PARAM_METALLIC, metal);
        }

        public metallicTexByID(platTexID: number, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var platTex = getObj(platTexID) as PlatformTexture;
            if (platTex == null) {
                return;
            }
            this.metallicTex(platTex, wrapMode, minFilter, magFilter);
        }

        public metallicTex(platTex: PlatformTexture, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var sampler = new Filament.TextureSampler(minFilter, magFilter, wrapMode);
            this.setTextureParam(this.PARAM_METALLIC, platTex, sampler);
        }

        public normalTexByID(platTexID: number, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var platTex = getObj(platTexID) as PlatformTexture;
            if (platTex == null) {
                return;
            }
            this.normalTex(platTex, wrapMode, minFilter, magFilter);
        }

        public normalTex(platTex: PlatformTexture, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var sampler = new Filament.TextureSampler(minFilter, magFilter, wrapMode);
            this.setTextureParam(this.PARAM_NORMAL, platTex, sampler);
        }

        public reflectance(reflect: number) {
            this._materialInstance.setFloatParameter(this.PARAM_REFLECTANCE, reflect);
        }

        public reflectanceTexByID(platTexID: number, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var platTex = getObj(platTexID) as PlatformTexture;
            if (platTex == null) {
                return;
            }
            this.reflectanceTex(platTex, wrapMode, minFilter, magFilter);
        }

        public reflectanceTex(platTex: PlatformTexture, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var sampler = new Filament.TextureSampler(minFilter, magFilter, wrapMode);
            this.setTextureParam(this.PARAM_REFLECTANCE, platTex, sampler);
        }

        public roughness(reflect: number) {
            this._materialInstance.setFloatParameter(this.PARAM_ROUGHNESS, reflect);
        }

        public roughnessTexByID(platTexID: number, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var platTex = getObj(platTexID) as PlatformTexture;
            if (platTex == null) {
                return;
            }
            this.roughnessTex(platTex, wrapMode, minFilter, magFilter);
        }

        public roughnessTex(platTex: PlatformTexture, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var sampler = new Filament.TextureSampler(minFilter, magFilter, wrapMode);
            this.setTextureParam(this.PARAM_ROUGHNESS, platTex, sampler);
        }

        public colorLUTByID(platTexID: number, wrapMode: Filament.WrapMode, minFilter: Filament.MinFilter, magFilter: Filament.MagFilter) {
            var platTex = getObj(platTexID) as PlatformTexture;
            if (platTex == null) {
                return;
            }
            this.colorLUT(platTex);
        }

        public colorLUT(platTex: PlatformTexture) {
            var sampler = new Filament.TextureSampler(Filament.MinFilter.NEAREST_MIPMAP_LINEAR, Filament.MagFilter.LINEAR, Filament.WrapMode.CLAMP_TO_EDGE);
            this.setTextureParam(this.PARAM_COLOR_LUT, platTex, sampler);
        }

        public setDoubleSided(isDoubleSided: boolean) {
            this._materialInstance.setDoubleSided(isDoubleSided);
        }

        public setCullingMode(mode: Filament.CullingMode) {
            this._materialInstance.setCullingMode(mode);
        }

        public setClipSpaceTransform(scaleX: number, scaleY: number, translateX: number, translateY) {
            this._materialInstance.setFloat4Parameter(this.PARAM_CLIP_SPACE_TRANSFORM, [scaleX, scaleY, translateX, translateY]);
        }

        public setValue(paramName: string, val: number) {
            var param = this.convertParamName(paramName);
            if (param == null) {
                return;
            }
            this._materialInstance.setFloatParameter(param, val);
        }

    }

    class PlatformMesh extends PlatformBase {
        private _entityID: EntityID;
        private _subMeshes: PlatformMeshSubGeometry[];

        constructor(entityID: EntityID, subMeshes: PlatformMeshSubGeometry[]) {
            super();
            this._entityID = entityID;
            this._subMeshes = subMeshes;
        }

        public getSubGeometry(subMeshIndex: number): PlatformMeshSubGeometry {
            return this._subMeshes[subMeshIndex];
        }

        public getEntityID(): EntityID { return this._entityID; }
        public setEntityID(id: EntityID) { this._entityID = id; }
        public getSubMeshes(): PlatformMeshSubGeometry[] { return this._subMeshes; }
    }

    class PlatformSkybox extends PlatformBase {
        private _skybox: Filament.Skybox;
        private _indirectLight: PlatformIndirectLight;

        public constructor(skybox: Filament.Skybox, indirectLight: PlatformIndirectLight) {
            super();
            this._skybox = skybox;
            this._indirectLight = indirectLight;
        }

        //TODO: Skybox::Builder??

        public getSkybox(): Filament.Skybox { return this._skybox; }
        public getIndirectLight(): PlatformIndirectLight { return this._indirectLight; }
        public getLightType(): IndirectLightType{ return this._indirectLight.getIndirectLightType();}
    }

    class PlatformViewport extends PlatformBase {
        private _left: number;
        private _top: number;
        private _width: number;
        private _height: number;

        public constructor(left: number, top: number, width: number, height: number) {
            super();
            this._left = left;
            this._top = top;
            this._width = width;
            this._height = height;
        }

        public getViewport(): number[] { return [this._left, this._top, this._width, this._height]; }
        public getLeft(): number { return this._left; }
        public getTop(): number { return this._top; }
        public getWidth(): number { return this._width; }
        public getHeight(): number { return this._height; }
    }

    //Update FilamentVertexBuffer.stride when ever you add to this
    enum VertexFormat {
        VFMT_POS = 0,
        VFMT_POS_COLOR,
        VFMT_POS_UV0,
        VFMT_POS_UV0_TAN,
        VFMT_NUM_VERTEX_FORMATS
    }

    class Vertex_Pos {
        position: Filament.float3;
    }

    class Vertex_Pos_Color {
        position: Filament.float3;
        color: number;
    }

    class PlatformVertexBuffer extends PlatformBase {

        private _format: VertexFormat;
        private _vertexBuffer: Filament.VertexBuffer;
        private _numVerts: number;

        constructor(vertexFormat: VertexFormat, vertexBuffer: Filament.VertexBuffer) {
            super();
            this._vertexBuffer = vertexBuffer;
            this._format = vertexFormat;
        }

        public getVertexBuffer(): Filament.VertexBuffer { return this._vertexBuffer; }
        public getFormat(): VertexFormat { return this._format; }
        public getNumVerts(): number { return this._numVerts; }

        public static build(engine: Filament.Engine, vertexFormat: VertexFormat, numVerts: number): Filament.VertexBuffer {

            var stride = this.stride(vertexFormat);
            var vertexBuffer: Filament.VertexBuffer = null;

            switch (vertexFormat) {

                case VertexFormat.VFMT_POS:
                    vertexBuffer = Filament.VertexBuffer.Builder()
                        .bufferCount(1)
                        .vertexCount(numVerts)
                        .attribute(Filament.VertexAttribute.POSITION, 0, Filament.VertexBuffer$AttributeType.FLOAT3, 0, stride)
                        .build(engine);
                    break;
                case VertexFormat.VFMT_POS_COLOR:
                    vertexBuffer = Filament.VertexBuffer.Builder()
                        .bufferCount(1)
                        .vertexCount(numVerts)
                        .attribute(Filament.VertexAttribute.POSITION, 0, Filament.VertexBuffer$AttributeType.FLOAT3, 0, stride)
                        .attribute(Filament.VertexAttribute.COLOR, 0, Filament.VertexBuffer$AttributeType.BYTE4, 12, stride)
                        .build(engine);
                    break;
                case VertexFormat.VFMT_POS_UV0:
                    vertexBuffer = Filament.VertexBuffer.Builder()
                        .bufferCount(1)
                        .vertexCount(numVerts)
                        .attribute(Filament.VertexAttribute.POSITION, 0, Filament.VertexBuffer$AttributeType.FLOAT3, 0, stride)
                        .attribute(Filament.VertexAttribute.UV0, 0, Filament.VertexBuffer$AttributeType.FLOAT2, 12, stride)
                        .build(engine);
                case VertexFormat.VFMT_POS_UV0_TAN:
                    vertexBuffer = Filament.VertexBuffer.Builder()
                        .bufferCount(1)
                        .vertexCount(numVerts)
                        .attribute(Filament.VertexAttribute.POSITION, 0, Filament.VertexBuffer$AttributeType.FLOAT3, 0, stride)
                        .attribute(Filament.VertexAttribute.UV0, 0, Filament.VertexBuffer$AttributeType.FLOAT2, 12, stride)
                        .attribute(Filament.VertexAttribute.TANGENTS, 0, Filament.VertexBuffer$AttributeType.FLOAT4, 20, stride)
                        .build(engine);
                    break;
            }

            return vertexBuffer;

        }

        //TODO: Is this still used for anything?
        public static stride(vertexFormat: VertexFormat): number {
            const strides: number[] = [
                12, // VFMT_POS
                16, // VFMT_POS_COLOR
                20, // VFMT_POS_UV0
                36,  // VFMT_POS_UV0_TAN
            ];
            return strides[vertexFormat];
        }

        public stride(): number {
            return PlatformVertexBuffer.stride(this._format);
        }

        public setVerticesPos(engine: Filament.Engine, sktPositions: number[][], srcOffset: number, offset: number, count: number): boolean {
            if (count == 0) {
                return false;
            }

            var size = 3; //PointD
            var newVerts = new Array<number>(size * count);

            for (var idx = 0; idx < count; ++idx) {
                var conv = FilamentUnits.convertPtSktToFil(sktPositions[idx]);
                for (var j = 0; j < size; j++) {
                    newVerts[idx * size + j] = conv[j];
                }
            }

            var verts = new Float32Array(newVerts);
            var byteOffset = this.stride() * offset;
            this._vertexBuffer.setBufferAt(engine, 0, verts, byteOffset);
            return true;
        }

        public setVerticesColor(engine: Filament.Engine, sktPositions: number[][], filColors: number[], srcOffset: number, offset: number, count: number): boolean {
            if (count == 0) {
                return false;
            }

            var size = 4; //PointD + Color
            var newVerts = new Array<number>(size * count);

            for (var idx = 0; idx < count; ++idx) {
                var conv = FilamentUnits.convertPtSktToFil(sktPositions[idx]);
                for (var j = 0; j < 3; j++) {
                    newVerts[idx * size + j] = conv[j];
                }
                newVerts[idx * size + 3] = filColors[idx]
            }

            var colors = new Uint32Array(newVerts);
            var byteOffset = this.stride() * offset;
            this._vertexBuffer.setBufferAt(engine, 0, colors, byteOffset);
            return true;
        }

        public setVerticesUV0(engine: Filament.Engine, sktPositions: number[][], texCoords: number[], srcOffset: number, offset: number, count: number): boolean {
            if (count == 0) {
                return false;
            }

            var size = 5; //PointD + UV0
            var newVerts = new Array<number>(size * count);

            for (var idx = 0; idx < count; ++idx) {
                var conv = FilamentUnits.convertPtSktToFil(sktPositions[idx]);
                for (var j = 0; j < 3; j++) {
                    newVerts[idx * size + j] = conv[j];
                }
                newVerts[idx * size + 3] = texCoords[idx * 2]
                newVerts[idx * size + 4] = texCoords[idx * 2 + 1]
            }

            var coords = new Float32Array(newVerts);
            var byteOffset = this.stride() * offset;
            this._vertexBuffer.setBufferAt(engine, 0, coords, byteOffset);
            return true;
        }

        public setVerticesTan(engine: Filament.Engine, sktPositions: number[][], texCoords: number[], sktNormal: number[], srcOffset: number, offset: number, count: number): boolean {
            if (count == 0) {
                return false;
            }

            var size = 9; //PointD + UV0 + normals
            var newVerts = new Array<number>(size * count);

            for (var idx = 0; idx < count; ++idx) {
                //Positions
                var conv = FilamentUnits.convertPtSktToFil(sktPositions[idx]);
                for (var j = 0; j < 3; j++) {
                    newVerts[idx * size + j] = conv[j];
                }
                //UVs
                newVerts[idx * size + 3] = texCoords[idx * 2]
                newVerts[idx * size + 4] = texCoords[idx * 2 + 1]
                
                //Normals
                newVerts[idx * size + 5] = sktNormal[0];
                newVerts[idx * size + 6] = sktNormal[1];
                newVerts[idx * size + 7] = sktNormal[2];
                newVerts[idx * size + 8] = 0;
            }
                
            var byteOffset = this.stride() * offset;
            this._vertexBuffer.setBufferAt(engine, 0, new Float32Array(newVerts), byteOffset);
            return true;
        }

        public destory(engine: Filament.Engine) {
            engine.destroyVertexBuffer(this._vertexBuffer);
        }

    }

    class PlatformIndexBuffer extends PlatformBase {

        private _indexBuffer: Filament.IndexBuffer;
        private _numIndices: number = 0;

        public constructor(indexBuffer: Filament.IndexBuffer) {
            super();
            this._indexBuffer = indexBuffer;
        }

        public getIndexBuffer(): Filament.IndexBuffer { return this._indexBuffer; }

        public destroy(engine: Filament.Engine) {
            engine.destroyIndexBuffer(this._indexBuffer);
        }

        public setIndices(engine: Filament.Engine, indices: number[], offset: number, numIndices: number): boolean {
            if (numIndices <= 0) {
                return false;
            }
            this._numIndices = numIndices;
            var ind = new Uint16Array(indices);
            var stride = 2;
            var byteOffset = stride * offset;

            this._indexBuffer.setBuffer(engine, ind, byteOffset)
            return true;
        }

        public numIndices(): number {
            return this._numIndices;
        }

        public static build(engine: Filament.Engine, numIndices: number): Filament.IndexBuffer {
            return Filament.IndexBuffer.Builder()
                .bufferType(Filament.IndexBuffer$IndexType.USHORT)
                .indexCount(numIndices)
                .build(engine);
        }

    }

    //Don't have access to Filament's bounding box, so created a new one.
    class Box implements Filament.Box {
        center: Filament.float3;
        halfExtent: Filament.float3;

        public set(min: Filament.float3, max: Filament.float3): Box {
            var c0 = (max[0] + min[0]) * 0.5;
            var c1 = (max[1] + min[1]) * 0.5;
            var c2 = (max[2] + min[2]) * 0.5;

            var h0 = (max[0] - min[0]) * 0.5;
            var h1 = (max[1] - min[1]) * 0.5;
            var h2 = (max[2] - min[2]) * 0.5;

            this.center = [c0, c1, c2];
            this.halfExtent = [h0, h1, h2];

            return this;
        }
    }

    class PlatformBoundingBox extends PlatformBase {
        private _box: Box;

        constructor(box: Box) {
            super();
            this._box = box;
        }

        public getBox(): Box { return this._box; }

        public set(sktMin: number[], sktMax: number[]) {
            var convMin = FilamentUnits.convertPtSktToFil(sktMin as number[]);
            var convMax = FilamentUnits.convertPtSktToFil(sktMax as number[]);

            this.setConverted(convMin, convMax);
        }

        public setConverted(min: number[], max: number[]) {
            var newMin: Filament.float3 = [0, 0, 0];
            newMin[0] = Math.min(min[0], max[0]);
            newMin[1] = Math.min(min[1], max[1]);
            newMin[2] = Math.min(min[2], max[2]);

            var newMax: Filament.float3 = [0, 0, 0];
            newMax[0] = Math.max(min[0], max[0]);
            newMax[1] = Math.max(min[1], max[1]);
            newMax[2] = Math.max(min[2], max[2]);

            this._box.set(newMin, newMax);
        }

        public compute(sktPoints: number[][]) {
            var sktMinX = sktPoints[0][0];
            var sktMinY = sktPoints[0][1];
            var sktMinZ = sktPoints[0][2];
            var sktMaxX = sktMinX;
            var sktMaxY = sktMinY;
            var sktMaxZ = sktMinZ;

            for (var ptIdx = 1; ptIdx < sktPoints.length; ++ptIdx) {
                var pt = sktPoints[ptIdx];
                sktMinX = (pt[0] < sktMinX) ? pt[0] : sktMinX;
                sktMinY = (pt[1] < sktMinY) ? pt[1] : sktMinY;
                sktMinZ = (pt[2] < sktMinZ) ? pt[2] : sktMinZ;

                sktMaxX = (pt[0] > sktMaxX) ? pt[0] : sktMaxX;
                sktMaxY = (pt[1] > sktMaxY) ? pt[1] : sktMaxY;
                sktMaxZ = (pt[2] > sktMaxZ) ? pt[2] : sktMaxZ;
            }

            var sktMin = [sktMinX, sktMinY, sktMinZ];
            var sktMax = [sktMaxX, sktMaxY, sktMaxZ];
            var convMin = FilamentUnits.convertPtSktToFil(sktMin);
            var convMax = FilamentUnits.convertPtSktToFil(sktMax);
            this.setConverted(convMin, convMax);
        }

    }

    enum FenceWaitMode {
        MODE_FLUSH = 0,					// Flush the command stream
        MODE_DONT_FLUSH,				// Do not flush the command stream
    }

    enum FenceStatus {
        STATUS_ERROR,					// Either an error occurred, or the fence condition is not satisfied.
        STATUS_SATISFIED,				// The fence condition is satisfied.
        STATUS_TIMED_OUT,				// The wait timeout expired.  The fence condition is not satisfied.
    }

    //Don't have access to this
    class PlatformFence extends PlatformBase { }

    enum ObjID {
        NONE = 0,
    }

    export class FilamentObjectManager {
        private _objMap: Map<ObjID, any>;
        private _idMgr: IdManager;
        public static readonly OBJ_PREFIX = "FILAMENT_API_OBJ_"; // THIS NEEDS TO MATCH THE STRING IN FilamentAPI.cs in PlatformBase

        constructor() {
            this._objMap = new Map<ObjID, any>();
            this._idMgr = new IdManager();
        }

        public add(obj: any): ObjID {
            var id = this._idMgr.getId();
            this._objMap.set(id, obj);
            //Store the object in the window so we can call functions directly on it from C#
            window[this.getObjIDStr(id)] = obj;
            return id as ObjID;
        }

        public get(id: ObjID): any {
            if (this.has(id)) {
                return this._objMap.get(id);
            }
            else {
                alert("Failed to find obj: " + id.toString());
                return null; 
            }
        }

        public has(id: ObjID): boolean {
            return this._objMap.has(id);
        }

        public remove(id: ObjID) {
            if (this.has(id)) {
                this._objMap.delete(id);
                //Remove the object from the window
                delete window[this.getObjIDStr(id)];
            }
        }

        private getObjIDStr(id: number): string {
            return FilamentObjectManager.OBJ_PREFIX + id.toString();
        }
    }

    export class FilamentAPI {

        private _assets: string[];
        private _engine: Filament.Engine;
        private _canvas: HTMLCanvasElement;
        private _filamentPrimLUT: Filament.RenderableManager$PrimitiveType[];
        private _entityMgr: PlatformEntityManager;

        public constructor() {
        }

        public isInitialized(): boolean {
            return (window as any).FilamentInitialized;
        }

        public init(assets: string[], canvas: HTMLCanvasElement) {

            this._assets = assets;

            Filament.init(assets, () => {
                console.log("Filament Initialized!");
                (window as any).FilamentInitialized = true;
            });

            if (assets.length == 0) {
                (window as any).FilamentInitialized = true;
            }

            //Create the engine
            this._engine = Filament.Engine.create(canvas);
            this._canvas = canvas;

            //TODO: Figure this out, probably using the assets passed in
            //this._standardMaterials = this._engine.getDefaultMaterial();

            this._filamentPrimLUT = [
                Filament.RenderableManager$PrimitiveType.POINTS,
                Filament.RenderableManager$PrimitiveType.LINES,
                Filament.RenderableManager$PrimitiveType.TRIANGLES,
            ];

            this._entityMgr = new PlatformEntityManager();
        }

        private getFilamentPrimType(sktPrimType: Filament.RenderableManager$PrimitiveType) {
            return this._filamentPrimLUT[sktPrimType as number];
        }

        public destory() {
            this.shutdown();
        }

        public shutdown() {

            delete this._entityMgr;

            //TODO: When standard materials are setup add clean up code here

            //TODO: Clean up PlatformAPI when its setup

            delete this._engine;

        }

        public loadMaterial(matType, buffer, bufferSize) {
            //TODO: Implement this 
        }

        public createMaterialInstance(matType: MaterialType): ObjID {
            //TODO: Figure out how to use matType
            var url = "";
            switch (matType) {
                case MaterialType.MTL_LIT_SIMPLE: {
                    url = this._assets[2];
                    break;
                }
                case MaterialType.MTL_LIT_TEXTURED: {
                    url = this._assets[3];
                    break;
                }
                case MaterialType.MTL_UI_ICON: {
                    url = this._assets[4];
                    break;
                }
                case MaterialType.MTL_UNLIT_COLOR: {
                    url = this._assets[5];
                    break;
                }
                case MaterialType.MTL_UNLIT_COLOR_ALPHA: {
                    url = this._assets[6];
                    break;
                }
                case MaterialType.MTL_UNLIT_FONT: {
                    url = this._assets[7];
                    break;
                }
                case MaterialType.MTL_UNLIT_FONT_OUTLINE: {
                    url = this._assets[8];
                    break;
                }
                case MaterialType.MTL_UNLIT_VERTEX_COLOR: {
                    url = this._assets[9];
                    break;
                }
                default: {
                    url = this._assets[5];
                    break;
                }
            }
            var matInst = this._engine.createMaterial(url);
            var platMatInst = new PlatformMaterialInstance(matInst.getDefaultInstance());
            return addObj(platMatInst);
        }

        public destoryMaterialInstance(platMatInstID: ObjID) {
            var platMatInst = getObj(platMatInstID) as PlatformMaterialInstance;
            if (platMatInst == null) {
                return;
            }
            this._engine.destroyMaterialInstance(platMatInst.getMaterialInstance());
            removeObj(platMatInstID);
        }

        //TODO: Get/Store platform objects in JS
        public createTexture(path, texType) {
            //TODO: Implement this
        }

        //TODO: Get/Store platform objects in JS
        public destroyTexture(platTexture) {
            //TODO: Implement this
        }

        public createCamera(): ObjID {
            var camera = this._engine.createCamera();
            var platCamera = new PlatformCamera(camera);
            return addObj(platCamera);
        }

        public lookAt(platCamID: ObjID, camPos: number[], camLook: number[], camUp: number[]) {
            var platCam = getObj(platCamID) as PlatformCamera;
            if (platCam == null) {
                return;
            }
            platCam.lookAt(camPos, camLook, camUp);
        }

        public setProjection(platCamID: ObjID, fovInDegrees: number, aspectRatio: number, nearPlane: number, farPlane: number) {
            var platCam = getObj(platCamID) as PlatformCamera;
            if (platCam == null) {
                return;
            }
            platCam.setProjection(fovInDegrees, aspectRatio, nearPlane, farPlane);
        }

        public destoryCamera(platCameraID: ObjID) {
            var platCamera = getObj(platCameraID) as PlatformCamera;
            if (platCamera == null) {
                return;
            }
            this._engine.destroyCamera(platCamera.getCamera());
            removeObj(platCameraID);
        }

        public createRenderContext(): ObjID {
            var swapChain = this._engine.createSwapChain();
            var renderer = this._engine.createRenderer();
            var renderContext = new PlatformRenderContext(swapChain, renderer);
            return addObj(renderContext);
        }

        public destroyRenderContext(platContextID: ObjID) {
            var platContext = getObj(platContextID) as PlatformRenderContext;
            if (platContext == null) {
                return;
            }
            this._engine.destroyRenderer(platContext.getRenderer());
            this._engine.destroySwapChain(platContext.getSwapChain());
            removeObj(platContextID);
        }

        public render(platRenderContextID: ObjID, platViewID: ObjID) {
            var platRenderContext = getObj(platRenderContextID) as PlatformRenderContext;
            var platView = getObj(platViewID) as PlatformView;
            if (platRenderContext == null || platView == null) {
                return null;
            }
            platRenderContext.render(platView.getView());
        }

        public createScene(): ObjID {
            var scene = this._engine.createScene();
            var platScene = new PlatformScene(scene);
            return addObj(platScene);
        }

        public destroyScene(platSceneID: ObjID) {
            var platScene = getObj(platSceneID) as PlatformScene;
            if (platScene == null) {
                return;
            }
            this._engine.destroyScene(platScene.getScene());
            removeObj(platSceneID);
        }

        public addMeshToScene(platSceneID: ObjID, platMeshID: ObjID) {

            var platScene = getObj(platSceneID) as PlatformScene;
            var platMesh = getObj(platMeshID) as PlatformMesh;

            if (platScene == null || platMesh == null) {
                return;
            }

            if (this._entityMgr.hasEntity(platMesh.getEntityID())) {
                var meshEntity = this._entityMgr.getEntity(platMesh.getEntityID());
                platScene.getScene().addEntity(meshEntity)
            }
        }

        public removeMeshFromScene(platSceneID: ObjID, platMeshID: ObjID) {
            var platScene = getObj(platSceneID) as PlatformScene;
            var platMesh = getObj(platMeshID) as PlatformMesh;

            if (platScene == null || platMesh == null) {
                return;
            }

            if (this._entityMgr.hasEntity(platMesh.getEntityID())) {
                var meshEntity = this._entityMgr.getEntity(platMesh.getEntityID());
                platScene.getScene().remove(meshEntity);
            }

        }

        public addIndirectLightToScene(platSceneID: ObjID, platLightID: ObjID) {
            var platScene = getObj(platSceneID) as PlatformScene;
            var platLight = getObj(platLightID) as PlatformIndirectLight;

            if (platScene == null || platLight == null) {
                return;
            }

            platScene.getScene().setIndirectLight(platLight.getIndirectLight());
        }

        public removeIndirectLightFromScene(platSceneID: ObjID) {
            var platScene = getObj(platSceneID) as PlatformScene;
            if (platScene == null) {
                return;
            }

            platScene.getScene().setIndirectLight(null);
        }

        public addLightToScene(platSceneID: ObjID, platLightID: ObjID) {
            var platScene = getObj(platSceneID) as PlatformScene;
            var platLight = getObj(platLightID) as PlatformLight;
            if (platScene == null || platLight == null) {
                return;
            }

            if (this._entityMgr.hasEntity(platLight.getEntityID())) {
                var lightEntity = this._entityMgr.getEntity(platLight.getEntityID())
                platScene.getScene().addEntity(lightEntity)
            }
        }

        public removeLightFromScene(platSceneID: ObjID, platLightID: ObjID) {

            var platScene = getObj(platSceneID) as PlatformScene;
            var platLight = getObj(platLightID) as PlatformLight;

            if (platScene == null || platLight == null) {
                return;
            }

            if (this._entityMgr.hasEntity(platLight.getEntityID())) {
                var lightEntity = this._entityMgr.getEntity(platLight.getEntityID())
                platScene.getScene().remove(lightEntity)
            }
        }

        public addSkyboxToScene(platSceneID: ObjID, platSkyboxID: ObjID) {
            var platScene = getObj(platSceneID) as PlatformScene;
            var platSkybox = getObj(platSkyboxID) as PlatformSkybox;
            if (platScene == null || platSkybox == null) {
                return;
            }
            platScene.getScene().setIndirectLight(platSkybox.getIndirectLight().getIndirectLight());
            platScene.getScene().setSkybox(platSkybox.getSkybox());
        }

        public removeSkyboxFromScene(platSceneID: ObjID, platSkyboxID: ObjID) {
            var platScene = getObj(platSceneID) as PlatformScene;
            var platSkybox = getObj(platSkyboxID) as PlatformSkybox;
            if (platScene == null || platSkybox == null) {
                return;
            }
            platScene.getScene().setIndirectLight(null);
            platScene.getScene().setSkybox(null);
        }

        public createViewport(left: number, top: number, width: number, height: number): ObjID {
            var dpr = window.devicePixelRatio; //Handles the browsers zoom level
            var viewport = new PlatformViewport(left * dpr, top * dpr, width * dpr, height * dpr)
            return addObj(viewport);
        }

        public destroyViewport(platViewportID: ObjID) {
            removeObj(platViewportID);
        }

        public createView(): ObjID {
            var view = this._engine.createView();
            var platView = new PlatformView(view, this._canvas);
            return addObj(platView);
        }

        public destroyView(platViewID: ObjID) {
            var platView = getObj(platViewID) as PlatformView;

            if (platView == null) {
                return;
            }

            this._engine.destroyView(platView.getView());
            platView.setCamera(null);
            platView.setScene(null);
            platView.setViewport(null);
            removeObj(platViewID);
        }

        public setCamera(platViewID: ObjID, platCamID: ObjID) {
            var platView = getObj(platViewID) as PlatformView;
            var platCam = getObj(platCamID) as PlatformCamera;
            if (platView == null || platCam == null) {
                return;
            }
            platView.setCamera(platCam);
        }

        public setScene(platViewID: ObjID, platSceneID: ObjID) {
            var platView = getObj(platViewID) as PlatformView;
            var platScene = getObj(platSceneID) as PlatformScene;
            if (platView == null || platScene == null) {
                return;
            }
            platView.setScene(platScene);
        }

        public setViewport(platViewID: ObjID, platViewportID: ObjID) {
            var platView = getObj(platViewID) as PlatformView;
            var platViewport = getObj(platViewportID) as PlatformViewport;
            if (platView == null || platViewport == null) {
                return;
            }
            platView.setViewport(platViewport);
        }

        public createVertexBuffer(format: VertexFormat, numVerts: number): ObjID {
            var vertexBuffer = PlatformVertexBuffer.build(this._engine, format, numVerts);
            var platVertexBuffer = new PlatformVertexBuffer(format, vertexBuffer);
            return addObj(platVertexBuffer);
        }

        public destroyVertexBuffer(platVertexBufferID: ObjID) {
            var platVertexBuffer = getObj(platVertexBufferID) as PlatformVertexBuffer;
            if (platVertexBuffer == null) {
                return;
            }

            platVertexBuffer.destory(this._engine);
            removeObj(platVertexBufferID);
        }

        public setClearColor(platViewID: ObjID, r: number, g: number, b: number) {
            var platView = getObj(platViewID) as PlatformView;
            if (platView == null) {
                return;
            }
            platView.getView().setClearColor([r, g, b, 1.0]);
        }

        public setVerticesPos(platVertexBufferID: ObjID, sktPositions: number[][], srcOffset: number, offset: number, count: number): boolean {
            var platVertexBuffer = getObj(platVertexBufferID) as PlatformVertexBuffer;

            if (platVertexBuffer == null) {
                return false;
            }

            return platVertexBuffer.setVerticesPos(this._engine, sktPositions, srcOffset, offset, count);
        }

        public setVerticesPosColor(platVertexBufferID: ObjID, sktPositions: number[][], filColors: number[], srcOffset: number, offset: number, count: number): boolean {
            var platVertexBuffer = getObj(platVertexBufferID) as PlatformVertexBuffer;

            if (platVertexBuffer == null) {
                return false;
            }

            return platVertexBuffer.setVerticesColor(this._engine, sktPositions, filColors, srcOffset, offset, count);
        }

        public setVerticesPosUV0(platVertexBufferID: ObjID, sktPositions: number[][], texCoords: number[], offset: number, srcOffset: number, count: number): boolean {
            var platVertexBuffer = getObj(platVertexBufferID) as PlatformVertexBuffer;

            if (platVertexBuffer == null) {
                return false;
            }

            return platVertexBuffer.setVerticesUV0(this._engine, sktPositions, texCoords, srcOffset, offset, count);
        }

        public setVerticesPosUV0Tan(platVertexBufferID: ObjID, sktPositions: number[][], normal: number[], texCoords: number[], srcOffset: number, offset: number, count: number): boolean {
            var platVertexBuffer = getObj(platVertexBufferID) as PlatformVertexBuffer;

            if (platVertexBuffer == null) {
                return false;
            }

            return platVertexBuffer.setVerticesTan(this._engine, sktPositions, texCoords, normal, srcOffset, offset, count);
        }

        public setVerticesPosUV0Tan2(platVertexBufferID: ObjID, sktPositions: number[][], normal: number[], texCoords: number[], offset: number, count: number, localIndices: number[]): boolean {

            //TODO: Figure out how this is supposed to work
            return this.setVerticesPosUV0Tan(platVertexBufferID, sktPositions, normal, texCoords, 0, offset, count);
        }

        public setVerticesScreenSpace(platVertexBufferID: ObjID, sktPositions: number[][], texCoords: number[], srcOffset: number, offset: number, count: number): boolean {
            //TODO: Figure out how to do these versions of setVertices correctly
            //return this.setVerticesPos(platVertexBufferID, sktPositions, srcOffset, offset, count);
            return true;
        }

        public createIndexBuffer(numIndices: number): ObjID {
            var indexBuffer = PlatformIndexBuffer.build(this._engine, numIndices);
            var platIndexBuffer = new PlatformIndexBuffer(indexBuffer);
            return addObj(platIndexBuffer);
        }

        public destroyIndexBuffer(platIndexBufferID: ObjID) {
            var platIndexBuffer = getObj(platIndexBufferID) as PlatformIndexBuffer;
            if (platIndexBuffer == null) {
                return;
            }
            platIndexBuffer.destroy(this._engine);
            removeObj(platIndexBufferID);
        }

        public setIndices(platIndexBufferID: ObjID, indices: number[], offset: number, numIndices: number): boolean {
            var platIndexBuffer = getObj(platIndexBufferID) as PlatformIndexBuffer;
            if (platIndexBuffer == null) {
                return false;
            }

            platIndexBuffer.setIndices(this._engine, indices, offset, numIndices);
            return true;
        }

        public createBoundingBox(sktMin: number[], sktMax: number[]): ObjID {
            var box = new Box();
            var platBox = new PlatformBoundingBox(box);
            platBox.set(sktMin, sktMax);
            return addObj(platBox);
        }

        public createBoundingBoxPts(sktPoints: number[][]): ObjID {
            var box = new Box();
            var platBox = new PlatformBoundingBox(box);
            platBox.compute(sktPoints);
            return addObj(platBox);
        }

        public destroyBoundingBox(platBoxID: ObjID) {
            var platBox = getObj(platBoxID) as PlatformBoundingBox;
            if (platBox == null) {
                return;
            }
            removeObj(platBoxID);
        }

        public createMeshPrim(primType: Filament.RenderableManager$PrimitiveType, platVertexBufferID: ObjID, platIndexBufferID: ObjID,
            offset: number, count: number, platMatInstID: ObjID, platBBoxID: ObjID, castShadows: boolean, receiveShadows: boolean): ObjID {
            var platMatInst = getObj(platMatInstID) as PlatformMaterialInstance;
            if (platMatInst == null) {
                return -1; //TODO: Maybe return something else in these cases
            }

            var subMeshes: ObjID[] = [
                addObj(new PlatformMeshSubGeometry(primType, offset, count, platMatInst)),
            ];

            return this.createMeshNew(platVertexBufferID, platIndexBufferID, subMeshes, platBBoxID, castShadows, receiveShadows);
        }

        public createMeshNew(platVertexBufferID: ObjID, platIndexBufferID: ObjID, subMeshIDs: ObjID[], platBBoxID: ObjID, castShadows: boolean, receiveShadows: boolean): ObjID {
            return this.createMesh(EntityID.ENTID_NULL, platVertexBufferID, platIndexBufferID, subMeshIDs, platBBoxID, castShadows, receiveShadows);
        }

        public createMesh(entityID: EntityID, platVertexBufferID: ObjID, platIndexBufferID: ObjID, subMeshIDs: ObjID[], platBBoxID: ObjID, castShadows: boolean, receiveShadows: boolean): ObjID {
            const MAX_SUB_MESHES: number = 4;

            var vertexBuff = getObj(platVertexBufferID) as PlatformVertexBuffer;
            var indexBuff = getObj(platIndexBufferID) as PlatformIndexBuffer;
            var bbox = getObj(platBBoxID) as PlatformBoundingBox;

            if (vertexBuff == null || indexBuff == null || bbox == null) {
                alert("Failed to create mesh!");
                return -1;
            }

            var subMeshes: Array<PlatformMeshSubGeometry> = new Array<PlatformMeshSubGeometry>(subMeshIDs.length);
            for (var i = 0; i < subMeshIDs.length; i++) {
                var subMesh = getObj(subMeshIDs[i]) as PlatformMeshSubGeometry;
                if (subMesh == null) {
                    alert("Failed to create mesh!");
                    return -1;
                }
                subMeshes[i] = subMesh;
            }

            if (entityID == EntityID.ENTID_NULL) {
                entityID = this._entityMgr.createEntity();
            }

            var meshEntity = this._entityMgr.getEntity(entityID);

            switch (subMeshIDs.length) {
                case 1:
                    {
                        var subMesh0 = subMeshes[0];
                        var matInst0 = subMesh0.getMaterialInstance();
                        var primType0 = this.getFilamentPrimType(subMesh0.getPrimType());
                        Filament.RenderableManager.Builder(1)
                            .boundingBox(bbox.getBox())
                            .material(0, matInst0.getMaterialInstance())
                            .geometryOffset(0, primType0, vertexBuff.getVertexBuffer(), indexBuff.getIndexBuffer(), subMesh0.getIndexOffset(), subMesh0.getIndexCount())
                            .culling(true)
                            .castShadows(castShadows)
                            .receiveShadows(receiveShadows)
                            .build(this._engine, meshEntity);
                        break;
                    }
                case 2:
                    {
                        var subMesh0 = subMeshes[0];
                        var matInst0 = subMesh0.getMaterialInstance();
                        var primType0 = this.getFilamentPrimType(subMesh0.getPrimType());

                        var subMesh1 = subMeshes[1];
                        var matInst1 = subMesh1.getMaterialInstance();
                        var primType1 = this.getFilamentPrimType(subMesh1.getPrimType());

                        Filament.RenderableManager.Builder(2)
                            .boundingBox(bbox.getBox())
                            .material(0, matInst0.getMaterialInstance())
                            .material(1, matInst1.getMaterialInstance())
                            .geometryOffset(0, primType0, vertexBuff.getVertexBuffer(), indexBuff.getIndexBuffer(), subMesh0.getIndexOffset(), subMesh0.getIndexCount())
                            .geometryOffset(1, primType1, vertexBuff.getVertexBuffer(), indexBuff.getIndexBuffer(), subMesh1.getIndexOffset(), subMesh1.getIndexCount())
                            .culling(true)
                            .castShadows(castShadows)
                            .receiveShadows(receiveShadows)
                            .build(this._engine, meshEntity);
                        break;
                    }
                case 3:
                    {
                        var subMesh0 = subMeshes[0];
                        var matInst0 = subMesh0.getMaterialInstance();
                        var primType0 = this.getFilamentPrimType(subMesh0.getPrimType());

                        var subMesh1 = subMeshes[1];
                        var matInst1 = subMesh1.getMaterialInstance();
                        var primType1 = this.getFilamentPrimType(subMesh1.getPrimType());

                        var subMesh2 = subMeshes[2];
                        var matInst2 = subMesh2.getMaterialInstance();
                        var primType2 = this.getFilamentPrimType(subMesh2.getPrimType());

                        Filament.RenderableManager.Builder(3)
                            .boundingBox(bbox.getBox())
                            .material(0, matInst0.getMaterialInstance())
                            .material(1, matInst1.getMaterialInstance())
                            .material(2, matInst2.getMaterialInstance())
                            .geometryOffset(0, primType0, vertexBuff.getVertexBuffer(), indexBuff.getIndexBuffer(), subMesh0.getIndexOffset(), subMesh0.getIndexCount())
                            .geometryOffset(1, primType1, vertexBuff.getVertexBuffer(), indexBuff.getIndexBuffer(), subMesh1.getIndexOffset(), subMesh1.getIndexCount())
                            .geometryOffset(2, primType2, vertexBuff.getVertexBuffer(), indexBuff.getIndexBuffer(), subMesh2.getIndexOffset(), subMesh2.getIndexCount())
                            .castShadows(castShadows)
                            .receiveShadows(receiveShadows)
                            .culling(true)
                            .build(this._engine, meshEntity);
                        break;
                    }
                case 4:
                    {
                        var subMesh0 = subMeshes[0];
                        var matInst0 = subMesh0.getMaterialInstance();
                        var primType0 = this.getFilamentPrimType(subMesh0.getPrimType());

                        var subMesh1 = subMeshes[1];
                        var matInst1 = subMesh1.getMaterialInstance();
                        var primType1 = this.getFilamentPrimType(subMesh1.getPrimType());

                        var subMesh2 = subMeshes[2];
                        var matInst2 = subMesh2.getMaterialInstance();
                        var primType2 = this.getFilamentPrimType(subMesh2.getPrimType());

                        var subMesh3 = subMeshes[3];
                        var matInst3 = subMesh3.getMaterialInstance();
                        var primType3 = this.getFilamentPrimType(subMesh3.getPrimType());

                        Filament.RenderableManager.Builder(4)
                            .boundingBox(bbox.getBox())
                            .material(0, matInst0.getMaterialInstance())
                            .material(1, matInst1.getMaterialInstance())
                            .material(2, matInst2.getMaterialInstance())
                            .material(3, matInst3.getMaterialInstance())
                            .geometryOffset(0, primType0, vertexBuff.getVertexBuffer(), indexBuff.getIndexBuffer(), subMesh0.getIndexOffset(), subMesh0.getIndexCount())
                            .geometryOffset(1, primType1, vertexBuff.getVertexBuffer(), indexBuff.getIndexBuffer(), subMesh1.getIndexOffset(), subMesh1.getIndexCount())
                            .geometryOffset(2, primType2, vertexBuff.getVertexBuffer(), indexBuff.getIndexBuffer(), subMesh2.getIndexOffset(), subMesh2.getIndexCount())
                            .geometryOffset(3, primType3, vertexBuff.getVertexBuffer(), indexBuff.getIndexBuffer(), subMesh3.getIndexOffset(), subMesh3.getIndexCount())
                            .culling(true)
                            .castShadows(castShadows)
                            .receiveShadows(receiveShadows)
                            .build(this._engine, meshEntity);
                        break;
                    }
            }

            var mesh = new PlatformMesh(entityID, subMeshes);
            return addObj(mesh);

        }

        public createMeshSubGeometry(primType: Filament.RenderableManager$PrimitiveType, outlineOffset: number, outlineCount: number, outlineMatInstID: ObjID): ObjID {
            var matInst = getObj(outlineMatInstID) as PlatformMaterialInstance;
            if (matInst == null) {
                return -1;
            }
            var mesh = new PlatformMeshSubGeometry(primType, outlineOffset, outlineCount, matInst);
            return addObj(mesh);
        }

        public reuseMesh(platMeshID: ObjID, platVertexBufferID: ObjID, platIndexBufferID: ObjID, subMeshIDs: ObjID[], platBBoxID: ObjID, castShadows: boolean, receiveShadows: boolean): ObjID {
            var mesh = getObj(platMeshID) as PlatformMesh;
            var entityID = EntityID.ENTID_NULL;
            if (mesh != null) {
                entityID = mesh.getEntityID();
            }
            return this.createMesh(entityID, platVertexBufferID, platIndexBufferID, subMeshIDs, platBBoxID, castShadows, receiveShadows);
        }

        public destroyMesh(platMeshID: ObjID) {
            var mesh = getObj(platMeshID) as PlatformMesh;
            if (mesh == null) {
                return;
            }

            //TODO: make sure material instances are cleaned up
            this._entityMgr.destroy(mesh.getEntityID());
            mesh.setEntityID(EntityID.ENTID_NULL);
            removeObj(platMeshID);
        }

        public setTransformSkt(platMeshID: ObjID, sktTransform: number[][]) {
            var conv = FilamentUnits.convertMatSktToFil(sktTransform);
            this.setTransform(platMeshID, conv);
        }

        public setTransformUnmodified(platMeshID: ObjID, transform: number[][]) {
            this.setTransform(platMeshID, transform);
        }

        public setTransform(platMeshID: ObjID, transform: number[][]) {
            var platMesh = getObj(platMeshID) as PlatformMesh;
            if (platMesh == null) {
                return;
            }

            var meshEntity = this._entityMgr.getEntity(platMesh.getEntityID());
            if (meshEntity == null) {
                return;
            }

            var transformMgr = this._engine.getTransformManager();

            if (transformMgr.hasComponent(meshEntity)) {
                var inst = transformMgr.getInstance(meshEntity);
                var mat4: Filament.mat4 = transform.reduce((acc, val) => acc.concat(val), []); //Flatten the array
                transformMgr.setTransform(inst, mat4);
            }
            else {
                this._engine.getTransformManager().create(meshEntity);
            }
        }

        public setMaterial(platMeshID: ObjID, subMeshIndex: number, platMatInstID: ObjID) {
            var platMesh = getObj(platMeshID) as PlatformMesh;
            var platMat = getObj(platMatInstID) as PlatformMaterialInstance;
            if (platMesh == null || platMat == null) {
                return;
            }

            var meshEntity = this._entityMgr.getEntity(platMesh.getEntityID());
            if (meshEntity == null) {
                return;
            }

            var rendMgr = this._engine.getRenderableManager();
            if (!rendMgr.hasComponent(meshEntity)) {
                return;
            }

            var inst = rendMgr.getInstance(meshEntity);
            rendMgr.setMaterialInstanceAt(inst, subMeshIndex, platMat.getMaterialInstance());
        }

        public createSkybox(indirectLightType: number): ObjID {
            //TODO: Use the indirectLightType to pick a skybox
            var indLight = this._engine.createIblFromKtx(this._assets[1]);

            var transform = FilamentUnits.SKETCH_COORDS_TO_FILAMENT_COORDS_MAT;
            indLight.setRotation(transform);

            var skybox = this._engine.createSkyFromKtx(this._assets[0]);
            var platIndirectLight = new PlatformIndirectLight(indLight, indirectLightType);
            var platSkybox = new PlatformSkybox(skybox, platIndirectLight);
            return addObj(platSkybox);
        }

        public destroySkybox(platSkyboxID: ObjID) {
            var platSkybox = getObj(platSkyboxID) as PlatformSkybox;
            if (platSkybox == null) {
                return;
            }
            removeObj(platSkyboxID);
            this._engine.destroySkybox(platSkybox.getSkybox());
            this._engine.destroyIndirectLight(platSkybox.getIndirectLight().getIndirectLight());
        }


        public createIndirectLight(lightType: IndirectLightType): ObjID {
            var indLight = PlatformIndirectLight.build(this._engine, lightType);

            var transform = FilamentUnits.SKETCH_COORDS_TO_FILAMENT_COORDS_MAT;
            indLight.setRotation(transform);

            var light = new PlatformIndirectLight(indLight, lightType);
            return addObj(light);
        }

        public createIndirectLightCubemap(lightType: IndirectLightType, cubemapID: ObjID): ObjID {

            var cubemap = getObj(cubemapID) as PlatformTexture;
            if (cubemap == null) {
                alert("Failed to create indirectlight with cubemap");
                return -1;
            }

            var indLight = PlatformIndirectLight.buildCubemap(this._engine, lightType, cubemap);
            indLight.setIntensity(30000);

            var transform = FilamentUnits.SKETCH_COORDS_TO_FILAMENT_COORDS_MAT;
            indLight.setRotation(transform);

            var light = new PlatformIndirectLight(indLight, lightType);
            return addObj(light);
        }

        public destroyIndirectLight(platLightID: ObjID) {
            var light = getObj(platLightID) as PlatformIndirectLight;
            if (light == null) {
                return;
            }
            this._engine.destroyIndirectLight(light.getIndirectLight());
            removeObj(platLightID);
        }

        public createLightDirectional(r: number, g: number, b: number, intensity: number, direction: number[], castsShadows: boolean): ObjID {
            var color = [r, g, b];

            var id = this._entityMgr.createEntity();
            var dirEntity = this._entityMgr.getEntity(id);

            Filament.LightManager.Builder(Filament.LightManager$Type.SUN)
                .color(color)
                .intensity(intensity)
                .direction(direction)
                .castShadows(castsShadows)
                //.shadowOptions(shadowOpts) //Not available 
                .build(this._engine, dirEntity);

            var dirLight = new PlatformLight(Filament.LightManager$Type.DIRECTIONAL, id);
            return addObj(dirLight);
        }

        public createLightSun(r: number, g: number, b: number, intensity: number, direction: number[], castsShadows: boolean): ObjID {
            var color = [r, g, b];

            var id = this._entityMgr.createEntity();
            var dirEntity = this._entityMgr.getEntity(id);

            Filament.LightManager.Builder(Filament.LightManager$Type.SUN)
                .color(color)
                .intensity(intensity)
                .direction(direction)
                .castShadows(castsShadows)
                //.shadowOptions(shadowOpts) //Not available 
                .build(this._engine, dirEntity);

            var dirLight = new PlatformLight(Filament.LightManager$Type.DIRECTIONAL, id);
            return addObj(dirLight);
        }

        public destroyLight(platLightID: ObjID) {

        }

        private getLightInstance(platLightID: ObjID) {
            var platLight = getObj(platLightID) as PlatformLight;
            if (platLight == null) {
                return;
            }

            var lightMgr = this._engine.getLightManager();
            var lightEntity = this._entityMgr.getEntity(platLight.getEntityID());

            if (lightEntity == null) {
                return;
            }

            var inst = lightMgr.getInstance(lightEntity);
            return inst;
        }

        public lightColor(platLightID: ObjID, r: number, g: number, b: number) {
            var inst = this.getLightInstance(platLightID);
            if (inst == null) {
                return;
            }
            this._engine.getLightManager().setColor(inst, [r, g, b]);
        }

        public lightIntensity(platLightID: ObjID, intensity: number) {
            var inst = this.getLightInstance(platLightID);
            if (inst == null) {
                return;
            }
            this._engine.getLightManager().setIntensity(inst, intensity);
        }

        public indirectLightIntensity(platLightID: ObjID, intensity: number) {
            var platLight = getObj(platLightID) as PlatformIndirectLight;
            if (platLight == null) {
                return;
            }
            platLight.setIntensity(intensity);
        }

        public lightDirection(platLightID: ObjID, direction: number[]) {
            var inst = this.getLightInstance(platLightID);
            if (inst == null) {
                return;
            }
            this._engine.getLightManager().setDirection(inst, direction);
        }

        public convert(sktVal: number): number {
            return FilamentUnits.convertFloatSktToFil(sktVal);
        }

        // public createFence(): ObjID {
        //     //TODO:Implement This
        // }

        // public destroyFence(platFenceID: ObjID) {
        //     //TODO:Implement This
        // }

        // public wait(platFenceID: ObjID, waitMode: FenceWaitMode): FenceStatus {
        //     //TODO: implement this
        //     return null;
        // }

        // public waitForeverAndDestroy(platFence: ObjID, waitMode: FenceWaitMode): FenceStatus {
        //     //TODO: implement this
        //     return null;
        // }

        // public getFenceStatus(platFendID: ObjID): FenceStatus{
        //     //TODO Implement this
        //     return null;
        // }


        private scene: Filament.Scene;
        private view: Filament.View;
        private camera: Filament.Camera;
        private swapChain: Filament.SwapChain;
        private renderer: Filament.Renderer;

        createTestScene() {
            //Create scene
            console.log("engine.createScene()");
            this.scene = this._engine.createScene();

            //Create camera
            console.log("engine.createCamera()");
            this.camera = this._engine.createCamera();
            const ONE_METER = 5000.0;
            const eye = [2.0 * ONE_METER, 10.0 * ONE_METER, 2.5 * ONE_METER];
            const center = [0.0, 0.0, 2.5 * ONE_METER];
            const up = [0.0, 0.0, 1.0];
            console.log("camera.lookAt(", eye, center, up, ")");
            this.camera.lookAt(eye, center, up);
            console.log("camera.setProjectionFov(", 45.0, this._canvas.width / this._canvas.height, ONE_METER * 0.05, ONE_METER * 1000.0, 0, ")");
            this.camera.setProjectionFov(45.0, this._canvas.width / this._canvas.height, ONE_METER * 0.05, ONE_METER * 1000.0, 0);

            //Create view
            console.log("engine.createView()")
            this.view = this._engine.createView();

            console.log("view.setCamera(", this.camera, ")");
            this.view.setCamera(this.camera);

            console.log("view.setScene(", this.scene, ")");
            this.view.setScene(this.scene);

            console.log("view.setClearColor(", [1.0, 0.0, 0.0, 1.0], ")");
            this.view.setClearColor([1.0, 0.0, 0.0, 1.0]);

            console.log("view.setViewport(", [0, 0, this._canvas.width, this._canvas.height], ")");
            this.view.setViewport([0, 0, this._canvas.width, this._canvas.height]);

            //Create swap chain
            console.log("engine.createSwapChain()");
            this.swapChain = this._engine.createSwapChain();

            //Create renderer
            console.log("engine.createRenderer()");
            this.renderer = this._engine.createRenderer();

            //Create geometry
            // var entity = Filament.EntityManager.get().create();
            // this.scene.addEntity(entity);

            // var vertices = new Float32Array([
            //     -5.0 * ONE_METER, 0.0, 0.0,
            //     -5.0 * ONE_METER, 0.0, 3.0 * ONE_METER,
            //     0.0, 0.0, 5.0 * ONE_METER,
            //     5.0 * ONE_METER, 0.0, 3.0 * ONE_METER,
            //     5.0 * ONE_METER, 0.0, 0.0
            // ]);

            // const VertexAttribute = Filament.VertexAttribute;
            // const AttributeType = Filament.VertexBuffer$AttributeType;
            // var vb = Filament.VertexBuffer.Builder()
            //     .bufferCount(1)
            //     .vertexCount(vertices.length)
            //     .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 12)
            //     .build(this._engine);
            // vb.setBufferAt(this._engine, 0, vertices);

            // var indicies = new Uint16Array([
            //     0, 1, 2,
            //     0, 2, 3,
            //     0, 3, 4,
            // ]);

            // var ib = Filament.IndexBuffer.Builder()
            //     .bufferType(Filament.IndexBuffer$IndexType.USHORT)
            //     .indexCount(9)
            //     .build(this._engine);
            // ib.setBuffer(this._engine, indicies);

            // Filament.RenderableManager.Builder(1)
            //     .boundingBox({
            //         center: [-1, -1, -1],
            //         halfExtent: [1, 1, 1]
            //     })
            //     .geometry(0, Filament.RenderableManager$PrimitiveType.TRIANGLES, vb, ib)
            //     .build(this._engine, entity);
        }

        renderOld() {
            console.log("renderer.render(", this.swapChain, this.view, ")");
            this.renderer.render(this.swapChain, this.view);
        }

        resize() {
            this.view.setViewport([0, 0, this._canvas.width, this._canvas.height]);
            this.camera.setProjectionFov(45, this._canvas.width / this._canvas.height, 1.0, 10.0, Filament.Camera$Fov.VERTICAL);
        }
    }
}

//Create an instance of FilamentAPI and store it in the window
(window as any).FilamentInitialized = false;
(window as any).FilamentObjectManager = new SketchRenderAPI.FilamentObjectManager();
(window as any).FilamentAPI = new SketchRenderAPI.FilamentAPI();