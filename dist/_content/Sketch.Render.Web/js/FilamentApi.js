"use strict";
////Object.defineProperty(exports, "__esModule", { value: true });
////const Filament = require("filament");
var SketchRenderAPI;
(function (SketchRenderAPI) {
    class PlatformBase {
        constructor() {
            this._type = this.constructor.name; //Only here for debugging 
        }
    }
    function getObjMgr() {
        return window.FilamentObjectManager;
    }
    function getObj(id) {
        return getObjMgr().get(id);
    }
    function addObj(obj) {
        return getObjMgr().add(obj);
    }
    function hasObj(id) {
        return getObjMgr().has(id);
    }
    function removeObj(id) {
        getObjMgr().remove(id);
    }
    class FilamentUnits {
        static convertFloatSktToFil(sktVal) {
            return sktVal * this.SKETCH_UNITS_TO_FILAMENT_UNITS;
        }
        static convertPtSktToFil(sktPt) {
            return [
                this.convertFloatSktToFil(sktPt[0]),
                this.convertFloatSktToFil(sktPt[1]),
                this.convertFloatSktToFil(sktPt[2])
            ];
        }
        static convertVec3SktToFil(sktPt) {
            return [
                this.convertFloatSktToFil(sktPt[0]),
                this.convertFloatSktToFil(sktPt[1]),
                this.convertFloatSktToFil(sktPt[2])
            ];
        }
        static convertMatSktToFil(sktMat) {
            var conv = [];
            for (var row = 0; row < sktMat.length; row++) {
                conv.push([]);
                for (var col = 0; col < sktMat[row].length; col++) {
                    conv[row][col] = this.convertFloatSktToFil(sktMat[row][col]);
                }
            }
            return conv;
        }
    }
    FilamentUnits.SKETCH_UNITS_TO_FILAMENT_UNITS = 1.0 / 5000.0;
    FilamentUnits.SKETCH_COORDS_TO_FILAMENT_COORDS_MAT = [
        1, 0, 0,
        0, 0, 1,
        0, -1, 0
    ];
    let EntityID;
    (function (EntityID) {
        EntityID[EntityID["ENTID_NULL"] = 0] = "ENTID_NULL";
    })(EntityID || (EntityID = {}));
    class PlatformEntityManager {
        constructor() {
            this._entityMap = new Map();
            this._idManager = new IdManager();
        }
        createEntity() {
            const newEntity = Filament.EntityManager.get().create();
            const id = this._idManager.getId();
            this._entityMap.set(id, newEntity);
            return id;
        }
        destroy(id) {
            if (!this._entityMap.has(id)) {
                return false;
            }
            //We don't have access to .destroy()
            //const entity = this._entityMap.get(id);
            //Filament.EntityManager.get().destroy(entity);
            this._entityMap.delete(id);
        }
        hasEntity(id) {
            return this._entityMap.has(id);
        }
        getEntity(id) {
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
        constructor() {
            this._id = 0;
        }
        getId() {
            this._id += 1;
            return this._id;
        }
        clear() {
            this._id = 0;
        }
    }
    class PlatformCamera extends PlatformBase {
        constructor(camera) {
            super();
            this.ONE_METER = 5000.0;
            this.DEFAULT_FOV = 45.0;
            this.DEFAULT_ASPECT_RATIO = 16.0 / 9.0;
            this.DEFAULT_NEAR_PLANE = this.ONE_METER * 0.05;
            this.DEFAULT_FAR_PLANE = this.ONE_METER * 1000.0;
            this._camera = camera;
            this.initialize();
        }
        initialize() {
            this.setProjection(this.DEFAULT_FOV, this.DEFAULT_ASPECT_RATIO, this.DEFAULT_NEAR_PLANE, this.DEFAULT_FAR_PLANE);
            const pos = [0, 0, this.ONE_METER];
            const lookPos = [0, this.ONE_METER, this.ONE_METER];
            const upVec = [0, 0, 1.0];
            this.lookAt(pos, lookPos, upVec);
        }
        lookAt(sktEye, sktCenter, sktUp) {
            const eye = FilamentUnits.convertPtSktToFil(sktEye);
            const center = FilamentUnits.convertPtSktToFil(sktCenter);
            this._camera.lookAt(eye, center, sktUp);
        }
        setProjection(fovInDegrees, aspect, near, far) {
            this._camera.setProjectionFov(fovInDegrees, aspect, FilamentUnits.convertFloatSktToFil(near), FilamentUnits.convertFloatSktToFil(far), Filament.Camera$Fov.VERTICAL);
        }
        setModelMatrix(sktMat) {
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
            var convPos = FilamentUnits.convertPtSktToFil(sktPos); // convert this way, rather than per-component to allow coordinate system conversion to happen
            modelMat[3][0] = convPos[0];
            modelMat[3][1] = convPos[1];
            modelMat[3][2] = convPos[2];
            // Copy the last value directly
            modelMat[3][3] = sktMat[3][3];
            // Flattens the 2d array into a single array which filament expects
            var flattened = modelMat.reduce((acc, val) => acc.concat(val), []);
            this._camera.setModelMatrix(flattened);
        }
        getCamera() { return this._camera; }
    }
    class PlatformRenderContext extends PlatformBase {
        constructor(swapChain, renderer) {
            super();
            this._swapChain = swapChain;
            this._renderer = renderer;
            this._render = this._render.bind(this);
        }
        renderByID(platViewID) {
            var platView = getObj(platViewID);
            if (platView == null) {
                return;
            }
            this.render(platView.getView());
        }
        render(view) {
            this._tempView = view;
            //window.requestAnimationFrame(this._render); //TODO: Make sure this is necessary
            this._render();
        }
        _render() {
            this._renderer.render(this._swapChain, this._tempView);
        }
        getSwapChain() { return this._swapChain; }
        getRenderer() { return this._renderer; }
    }
    class PlatformScene extends PlatformBase {
        constructor(scene) {
            super();
            this._scene = scene;
        }
        getScene() { return this._scene; }
    }
    let IndirectLightType;
    (function (IndirectLightType) {
        IndirectLightType[IndirectLightType["INDLIGHT_NOONGRASS"] = 0] = "INDLIGHT_NOONGRASS";
        IndirectLightType[IndirectLightType["INDLIGHT_DEFAULT_SKY"] = 1] = "INDLIGHT_DEFAULT_SKY";
        IndirectLightType[IndirectLightType["INDLIGHT_NUM_STANDARD_INDIRECT_LIGHTS"] = 2] = "INDLIGHT_NUM_STANDARD_INDIRECT_LIGHTS";
    })(IndirectLightType || (IndirectLightType = {}));
    class PlatformIndirectLight extends PlatformBase {
        constructor(indirectLight, indirectLightType) {
            super();
            this._indrectLight = indirectLight;
            this._indirectLightType = indirectLightType;
        }
        getIndirectLight() { return this._indrectLight; }
        getIndirectLightType() { return this._indirectLightType; }
        setIntensity(intensity) {
            this._indrectLight.setIntensity(intensity);
        }
        static getCoefficients(indirectLightType) {
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
        static buildCubemap(engine, lightType, cubemap) {
            return new Filament.IndirectLight$Builder()
                .reflections(cubemap.getTexture())
                .irradianceSh(3, this.getCoefficients(lightType))
                .build(engine);
        }
        static build(engine, lightType) {
            var light = new Filament.IndirectLight();
            var sh = this.getCoefficients(lightType);
            var flattened = sh.reduce((acc, val) => acc.concat(val), []);
            light.shfloats = flattened;
            return light;
        }
    }
    PlatformIndirectLight.noonGrassCoef = [
        [0.623220127315220, 0.886922625176132, 1.255084767605070],
        [-0.210521732019477, -0.270994631349530, -1.099017699677069],
        [0.031589825992246, 0.058418596454591, 0.159860525707438],
        [-0.002709596838855, 0.015904246634819, 0.028695913735464],
        [0.016667782987820, 0.026230409311113, 0.010163630191357],
        [-0.040963502607874, -0.050351523406741, -0.101756407860318],
        [-0.136296161919919, -0.140777720274997, -0.183877580383222],
        [-0.034435148087843, -0.051731329734875, -0.113001255527486],
        [-0.294609334103497, -0.345042383380244, -0.550035456175430] // L22
    ];
    PlatformIndirectLight.defaultSky = [
        [0.350047290325165, 0.350047290325165, 0.350047290325165],
        [0.155069604516029, 0.155069604516029, 0.155069604516029],
        [0.045930672436953, 0.045930672436953, 0.045930672436953],
        [-0.045964866876602, -0.045964866876602, -0.045964866876602],
        [-0.038627006113529, -0.038627006113529, -0.038627006113529],
        [0.038441505283117, 0.038441505283117, 0.038441505283117],
        [0.010158680379391, 0.010158680379391, 0.010158680379391],
        [-0.026496363803744, -0.026496363803744, -0.026496363803744],
        [0.030545882880688, 0.030545882880688, 0.030545882880688],
    ];
    class PlatformLight extends PlatformBase {
        constructor(lightType, entityID) {
            super();
            this._lightType = lightType;
            this._entityID = entityID;
        }
        getLightType() { return this._lightType; }
        getEntityID() { return this._entityID; }
    }
    class PlatformView extends PlatformBase {
        constructor(view, canvas) {
            super();
            this._view = view;
            this._canvas = canvas;
        }
        getView() { return this._view; }
        setCamera(camera) {
            this._camera = camera;
            this._view.setCamera(this._camera.getCamera());
        }
        setCameraByID(platCameraID) {
            var platCamera = getObj(platCameraID);
            if (platCamera == null) {
                return;
            }
            this.setCamera(platCamera);
        }
        getCamera() { return this._camera; }
        setScene(scene) {
            this._scene = scene;
            this._view.setScene(this._scene.getScene());
        }
        setSceneByID(platSceneID) {
            var platScene = getObj(platSceneID);
            if (platScene == null) {
                return;
            }
            this.setScene(platScene);
        }
        getScene() { return this._scene; }
        setViewport(viewport) {
            this._viewport = viewport;
            this._canvas.width = viewport.getWidth();
            this._canvas.height = viewport.getHeight();
            this._view.setViewport(viewport.getViewport());
        }
        setViewportByID(platViewportID) {
            var platViewport = getObj(platViewportID);
            if (platViewport == null) {
                return;
            }
            this.setViewport(platViewport);
        }
        getViewport() { return this._viewport; }
    }
    class PlatformMeshSubGeometry extends PlatformBase {
        constructor(primType, indexOffset, indexCount, materialInstance) {
            super();
            this._primType = primType;
            this._indexOffset = indexOffset;
            this._indexCount = indexCount;
            this._materialInstance = materialInstance;
        }
        getPrimType() { return this._primType; }
        getIndexOffset() { return this._indexOffset; }
        getIndexCount() { return this._indexCount; }
        getMaterialInstance() { return this._materialInstance; }
    }
    let CompressionType;
    (function (CompressionType) {
        CompressionType[CompressionType["UNKNOWN"] = 0] = "UNKNOWN";
        CompressionType[CompressionType["NONE"] = 1] = "NONE";
        CompressionType[CompressionType["BC1"] = 2] = "BC1";
        CompressionType[CompressionType["BC1N"] = 3] = "BC1N";
        CompressionType[CompressionType["BC1A"] = 4] = "BC1A";
        CompressionType[CompressionType["BC2"] = 5] = "BC2";
        CompressionType[CompressionType["BC3"] = 6] = "BC3";
        CompressionType[CompressionType["BC3N"] = 7] = "BC3N";
        CompressionType[CompressionType["BC4"] = 8] = "BC4";
        CompressionType[CompressionType["BC5"] = 9] = "BC5";
    })(CompressionType || (CompressionType = {}));
    let TextureType;
    (function (TextureType) {
        TextureType[TextureType["TEX_UNKNOWN"] = 0] = "TEX_UNKNOWN";
        TextureType[TextureType["TEX_COLOR"] = 1] = "TEX_COLOR";
        TextureType[TextureType["TEX_COLOR_LUT"] = 2] = "TEX_COLOR_LUT";
        TextureType[TextureType["TEX_NORMAL"] = 3] = "TEX_NORMAL";
        TextureType[TextureType["TEX_ROUGHNESS"] = 4] = "TEX_ROUGHNESS";
        TextureType[TextureType["TEX_METAL"] = 5] = "TEX_METAL";
        TextureType[TextureType["TEX_AO"] = 6] = "TEX_AO";
        TextureType[TextureType["TEX_REFLECTION"] = 7] = "TEX_REFLECTION";
        TextureType[TextureType["TEX_DISPLACEMENT"] = 8] = "TEX_DISPLACEMENT";
        TextureType[TextureType["TEX_CUBEMAP"] = 9] = "TEX_CUBEMAP";
    })(TextureType || (TextureType = {}));
    class TextureBuildInfo {
        constructor() {
            this.isInitialized = false;
            this.texture = null;
            this.width = 0;
            this.height = 0;
            this.depth = 0;
            this.pixelDataType = Filament.CompressedPixelDataType.DXT1_RGB; //TODO: This probably isn't correct for web??
            this.internFormat = Filament.Texture$InternalFormat.DXT1_RGB; //TODO: This probably ins't correct for web??
            this.numMipMaps = 0;
            this.texType = TextureType.TEX_UNKNOWN;
            this.compressionType = CompressionType.UNKNOWN;
        }
    }
    class PlatformTexture extends PlatformBase {
        constructor(texInfo) {
            super();
            this._width = texInfo.width;
            this._height = texInfo.height;
            this._texType = texInfo.texType;
            this._texInfo = texInfo;
        }
        getTexture() { return this._texInfo.texture; }
        destroy(engine) {
            if (this._texInfo.texture == null) {
                return;
            }
            engine.destroyTexture(this._texInfo.texture);
            delete this._texInfo;
        }
        static build() {
            //TODO: Implement these build functions
        }
    }
    let MaterialType;
    (function (MaterialType) {
        MaterialType[MaterialType["MTL_DEFAULT"] = 0] = "MTL_DEFAULT";
        MaterialType[MaterialType["MTL_UNLIT_COLOR"] = 1] = "MTL_UNLIT_COLOR";
        MaterialType[MaterialType["MTL_UNLIT_COLOR_ALPHA"] = 2] = "MTL_UNLIT_COLOR_ALPHA";
        MaterialType[MaterialType["MTL_UNLIT_FONT"] = 3] = "MTL_UNLIT_FONT";
        MaterialType[MaterialType["MTL_UNLIT_FONT_OUTLINE"] = 4] = "MTL_UNLIT_FONT_OUTLINE";
        MaterialType[MaterialType["MTL_UNLIT_VERTEX_COLOR"] = 5] = "MTL_UNLIT_VERTEX_COLOR";
        MaterialType[MaterialType["MTL_LIT_SIMPLE"] = 6] = "MTL_LIT_SIMPLE";
        MaterialType[MaterialType["MTL_LIT_TEXTURED"] = 7] = "MTL_LIT_TEXTURED";
        MaterialType[MaterialType["MTL_UI_ICON"] = 8] = "MTL_UI_ICON";
        MaterialType[MaterialType["MTL_NUM_STANDARD_MATERIALS"] = 9] = "MTL_NUM_STANDARD_MATERIALS";
    })(MaterialType || (MaterialType = {}));
    class PlatformMaterialInstance extends PlatformBase {
        constructor(materialInstance) {
            super();
            this._isInitialized = false;
            this.PARAM_ALBEDO = "albedo";
            this.PARAM_AMBIENT_OCCLUSION = "ao";
            this.PARAM_BASE_COLOR = "baseColor";
            this.PARAM_METALLIC = "metallic";
            this.PARAM_NORMAL = "normal";
            this.PARAM_ROUGHNESS = "roughness";
            this.PARAM_REFLECTANCE = "reflectance";
            this.PARAM_COLOR_LUT = "color_lut";
            this.PARAM_CLIP_SPACE_TRANSFORM = "clipSpaceTransform";
            this._materialInstance = materialInstance;
        }
        getMaterialInstance() { return this._materialInstance; }
        getIsInitialized() { return this._isInitialized; }
        setIsInitialized(value) { this._isInitialized = value; }
        setTextureParam(paramName, tex, sampler) {
            var filTex = tex.getTexture();
            this._materialInstance.setTextureParameter(paramName, filTex, sampler);
        }
        albedoTexByID(platTexID, wrapMode, minFilter, magFilter) {
            var platTex = getObj(platTexID);
            if (platTex == null) {
                return;
            }
            this.albedoTex(platTex, wrapMode, minFilter, magFilter);
        }
        albedoTex(platTex, wrapMode, minFilter, magFilter) {
            var sampler = new Filament.TextureSampler(minFilter, magFilter, wrapMode);
            this.setTextureParam(this.PARAM_ALBEDO, platTex, sampler);
        }
        ambientOcclusionTexByID(platTexID, wrapMode, minFilter, magFilter) {
            var platTex = getObj(platTexID);
            if (platTex == null) {
                return;
            }
            this.ambientOcclusionTex(platTex, wrapMode, minFilter, magFilter);
        }
        ambientOcclusionTex(platTex, wrapMode, minFilter, magFilter) {
            var sampler = new Filament.TextureSampler(minFilter, magFilter, wrapMode);
            this.setTextureParam(this.PARAM_AMBIENT_OCCLUSION, platTex, sampler);
        }
        baseColor(r, g, b, a) {
            this._materialInstance.setColor4Parameter(this.PARAM_BASE_COLOR, Filament.RgbaType.sRGB, [r / 255, g / 255, b / 255, a / 255]);
        }
        baseColorLinear(r, g, b, a) {
            this._materialInstance.setColor4Parameter(this.PARAM_BASE_COLOR, Filament.RgbaType.LINEAR, [r / 255, g / 255, b / 255, a / 255]);
        }
        //TODO: Might not need this for web
        convertParamName(paramName) {
            return paramName + "\0"; //null terminate
        }
        setColor(paramName, r, g, b, a) {
            var param = this.convertParamName(paramName);
            if (param == null) {
                return;
            }
            this._materialInstance.setColor4Parameter(param, Filament.RgbaType.sRGB, [r / 255, g / 255, b / 255, a / 255]);
        }
        setColorLinear(paramName, r, g, b, a) {
            var param = this.convertParamName(paramName);
            if (param == null) {
                return;
            }
            this._materialInstance.setColor4Parameter(param, Filament.RgbaType.LINEAR, [r / 255, g / 255, b / 255, a / 255]);
        }
        metallic(metal) {
            this._materialInstance.setFloatParameter(this.PARAM_METALLIC, metal);
        }
        metallicTexByID(platTexID, wrapMode, minFilter, magFilter) {
            var platTex = getObj(platTexID);
            if (platTex == null) {
                return;
            }
            this.metallicTex(platTex, wrapMode, minFilter, magFilter);
        }
        metallicTex(platTex, wrapMode, minFilter, magFilter) {
            var sampler = new Filament.TextureSampler(minFilter, magFilter, wrapMode);
            this.setTextureParam(this.PARAM_METALLIC, platTex, sampler);
        }
        normalTexByID(platTexID, wrapMode, minFilter, magFilter) {
            var platTex = getObj(platTexID);
            if (platTex == null) {
                return;
            }
            this.normalTex(platTex, wrapMode, minFilter, magFilter);
        }
        normalTex(platTex, wrapMode, minFilter, magFilter) {
            var sampler = new Filament.TextureSampler(minFilter, magFilter, wrapMode);
            this.setTextureParam(this.PARAM_NORMAL, platTex, sampler);
        }
        reflectance(reflect) {
            this._materialInstance.setFloatParameter(this.PARAM_REFLECTANCE, reflect);
        }
        reflectanceTexByID(platTexID, wrapMode, minFilter, magFilter) {
            var platTex = getObj(platTexID);
            if (platTex == null) {
                return;
            }
            this.reflectanceTex(platTex, wrapMode, minFilter, magFilter);
        }
        reflectanceTex(platTex, wrapMode, minFilter, magFilter) {
            var sampler = new Filament.TextureSampler(minFilter, magFilter, wrapMode);
            this.setTextureParam(this.PARAM_REFLECTANCE, platTex, sampler);
        }
        roughness(reflect) {
            this._materialInstance.setFloatParameter(this.PARAM_ROUGHNESS, reflect);
        }
        roughnessTexByID(platTexID, wrapMode, minFilter, magFilter) {
            var platTex = getObj(platTexID);
            if (platTex == null) {
                return;
            }
            this.roughnessTex(platTex, wrapMode, minFilter, magFilter);
        }
        roughnessTex(platTex, wrapMode, minFilter, magFilter) {
            var sampler = new Filament.TextureSampler(minFilter, magFilter, wrapMode);
            this.setTextureParam(this.PARAM_ROUGHNESS, platTex, sampler);
        }
        colorLUTByID(platTexID, wrapMode, minFilter, magFilter) {
            var platTex = getObj(platTexID);
            if (platTex == null) {
                return;
            }
            this.colorLUT(platTex);
        }
        colorLUT(platTex) {
            var sampler = new Filament.TextureSampler(Filament.MinFilter.NEAREST_MIPMAP_LINEAR, Filament.MagFilter.LINEAR, Filament.WrapMode.CLAMP_TO_EDGE);
            this.setTextureParam(this.PARAM_COLOR_LUT, platTex, sampler);
        }
        setDoubleSided(isDoubleSided) {
            this._materialInstance.setDoubleSided(isDoubleSided);
        }
        setCullingMode(mode) {
            this._materialInstance.setCullingMode(mode);
        }
        setClipSpaceTransform(scaleX, scaleY, translateX, translateY) {
            this._materialInstance.setFloat4Parameter(this.PARAM_CLIP_SPACE_TRANSFORM, [scaleX, scaleY, translateX, translateY]);
        }
        setValue(paramName, val) {
            var param = this.convertParamName(paramName);
            if (param == null) {
                return;
            }
            this._materialInstance.setFloatParameter(param, val);
        }
    }
    class PlatformMesh extends PlatformBase {
        constructor(entityID, subMeshes) {
            super();
            this._entityID = entityID;
            this._subMeshes = subMeshes;
        }
        getSubGeometry(subMeshIndex) {
            return this._subMeshes[subMeshIndex];
        }
        getEntityID() { return this._entityID; }
        setEntityID(id) { this._entityID = id; }
        getSubMeshes() { return this._subMeshes; }
    }
    class PlatformSkybox extends PlatformBase {
        constructor(skybox, indirectLight) {
            super();
            this._skybox = skybox;
            this._indirectLight = indirectLight;
        }
        //TODO: Skybox::Builder??
        getSkybox() { return this._skybox; }
        getIndirectLight() { return this._indirectLight; }
        getLightType() { return this._indirectLight.getIndirectLightType(); }
    }
    class PlatformViewport extends PlatformBase {
        constructor(left, top, width, height) {
            super();
            this._left = left;
            this._top = top;
            this._width = width;
            this._height = height;
        }
        getViewport() { return [this._left, this._top, this._width, this._height]; }
        getLeft() { return this._left; }
        getTop() { return this._top; }
        getWidth() { return this._width; }
        getHeight() { return this._height; }
    }
    //Update FilamentVertexBuffer.stride when ever you add to this
    let VertexFormat;
    (function (VertexFormat) {
        VertexFormat[VertexFormat["VFMT_POS"] = 0] = "VFMT_POS";
        VertexFormat[VertexFormat["VFMT_POS_COLOR"] = 1] = "VFMT_POS_COLOR";
        VertexFormat[VertexFormat["VFMT_POS_UV0"] = 2] = "VFMT_POS_UV0";
        VertexFormat[VertexFormat["VFMT_POS_UV0_TAN"] = 3] = "VFMT_POS_UV0_TAN";
        VertexFormat[VertexFormat["VFMT_NUM_VERTEX_FORMATS"] = 4] = "VFMT_NUM_VERTEX_FORMATS";
    })(VertexFormat || (VertexFormat = {}));
    class Vertex_Pos {
    }
    class Vertex_Pos_Color {
    }
    class PlatformVertexBuffer extends PlatformBase {
        constructor(vertexFormat, vertexBuffer) {
            super();
            this._vertexBuffer = vertexBuffer;
            this._format = vertexFormat;
        }
        getVertexBuffer() { return this._vertexBuffer; }
        getFormat() { return this._format; }
        getNumVerts() { return this._numVerts; }
        static build(engine, vertexFormat, numVerts) {
            var stride = this.stride(vertexFormat);
            var vertexBuffer = null;
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
        static stride(vertexFormat) {
            const strides = [
                12,
                16,
                20,
                36,
            ];
            return strides[vertexFormat];
        }
        stride() {
            return PlatformVertexBuffer.stride(this._format);
        }
        setVerticesPos(engine, sktPositions, srcOffset, offset, count) {
            if (count == 0) {
                return false;
            }
            var size = 3; //PointD
            var newVerts = new Array(size * count);
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
        setVerticesColor(engine, sktPositions, filColors, srcOffset, offset, count) {
            if (count == 0) {
                return false;
            }
            var size = 4; //PointD + Color
            var newVerts = new Array(size * count);
            for (var idx = 0; idx < count; ++idx) {
                var conv = FilamentUnits.convertPtSktToFil(sktPositions[idx]);
                for (var j = 0; j < 3; j++) {
                    newVerts[idx * size + j] = conv[j];
                }
                newVerts[idx * size + 3] = filColors[idx];
            }
            var colors = new Uint32Array(newVerts);
            var byteOffset = this.stride() * offset;
            this._vertexBuffer.setBufferAt(engine, 0, colors, byteOffset);
            return true;
        }
        setVerticesUV0(engine, sktPositions, texCoords, srcOffset, offset, count) {
            if (count == 0) {
                return false;
            }
            var size = 5; //PointD + UV0
            var newVerts = new Array(size * count);
            for (var idx = 0; idx < count; ++idx) {
                var conv = FilamentUnits.convertPtSktToFil(sktPositions[idx]);
                for (var j = 0; j < 3; j++) {
                    newVerts[idx * size + j] = conv[j];
                }
                newVerts[idx * size + 3] = texCoords[idx * 2];
                newVerts[idx * size + 4] = texCoords[idx * 2 + 1];
            }
            var coords = new Float32Array(newVerts);
            var byteOffset = this.stride() * offset;
            this._vertexBuffer.setBufferAt(engine, 0, coords, byteOffset);
            return true;
        }
        setVerticesTan(engine, sktPositions, texCoords, sktNormal, srcOffset, offset, count) {
            if (count == 0) {
                return false;
            }
            var size = 9; //PointD + UV0 + normals
            var newVerts = new Array(size * count);
            for (var idx = 0; idx < count; ++idx) {
                //Positions
                var conv = FilamentUnits.convertPtSktToFil(sktPositions[idx]);
                for (var j = 0; j < 3; j++) {
                    newVerts[idx * size + j] = conv[j];
                }
                //UVs
                newVerts[idx * size + 3] = texCoords[idx * 2];
                newVerts[idx * size + 4] = texCoords[idx * 2 + 1];
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
        destory(engine) {
            engine.destroyVertexBuffer(this._vertexBuffer);
        }
    }
    class PlatformIndexBuffer extends PlatformBase {
        constructor(indexBuffer) {
            super();
            this._numIndices = 0;
            this._indexBuffer = indexBuffer;
        }
        getIndexBuffer() { return this._indexBuffer; }
        destroy(engine) {
            engine.destroyIndexBuffer(this._indexBuffer);
        }
        setIndices(engine, indices, offset, numIndices) {
            if (numIndices <= 0) {
                return false;
            }
            this._numIndices = numIndices;
            var ind = new Uint16Array(indices);
            var stride = 2;
            var byteOffset = stride * offset;
            this._indexBuffer.setBuffer(engine, ind, byteOffset);
            return true;
        }
        numIndices() {
            return this._numIndices;
        }
        static build(engine, numIndices) {
            return Filament.IndexBuffer.Builder()
                .bufferType(Filament.IndexBuffer$IndexType.USHORT)
                .indexCount(numIndices)
                .build(engine);
        }
    }
    //Don't have access to Filament's bounding box, so created a new one.
    class Box {
        set(min, max) {
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
        constructor(box) {
            super();
            this._box = box;
        }
        getBox() { return this._box; }
        set(sktMin, sktMax) {
            var convMin = FilamentUnits.convertPtSktToFil(sktMin);
            var convMax = FilamentUnits.convertPtSktToFil(sktMax);
            this.setConverted(convMin, convMax);
        }
        setConverted(min, max) {
            var newMin = [0, 0, 0];
            newMin[0] = Math.min(min[0], max[0]);
            newMin[1] = Math.min(min[1], max[1]);
            newMin[2] = Math.min(min[2], max[2]);
            var newMax = [0, 0, 0];
            newMax[0] = Math.max(min[0], max[0]);
            newMax[1] = Math.max(min[1], max[1]);
            newMax[2] = Math.max(min[2], max[2]);
            this._box.set(newMin, newMax);
        }
        compute(sktPoints) {
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
    let FenceWaitMode;
    (function (FenceWaitMode) {
        FenceWaitMode[FenceWaitMode["MODE_FLUSH"] = 0] = "MODE_FLUSH";
        FenceWaitMode[FenceWaitMode["MODE_DONT_FLUSH"] = 1] = "MODE_DONT_FLUSH";
    })(FenceWaitMode || (FenceWaitMode = {}));
    let FenceStatus;
    (function (FenceStatus) {
        FenceStatus[FenceStatus["STATUS_ERROR"] = 0] = "STATUS_ERROR";
        FenceStatus[FenceStatus["STATUS_SATISFIED"] = 1] = "STATUS_SATISFIED";
        FenceStatus[FenceStatus["STATUS_TIMED_OUT"] = 2] = "STATUS_TIMED_OUT";
    })(FenceStatus || (FenceStatus = {}));
    //Don't have access to this
    class PlatformFence extends PlatformBase {
    }
    let ObjID;
    (function (ObjID) {
        ObjID[ObjID["NONE"] = 0] = "NONE";
    })(ObjID || (ObjID = {}));
    class FilamentObjectManager {
        constructor() {
            this._objMap = new Map();
            this._idMgr = new IdManager();
        }
        add(obj) {
            var id = this._idMgr.getId();
            this._objMap.set(id, obj);
            //Store the object in the window so we can call functions directly on it from C#
            window[this.getObjIDStr(id)] = obj;
            return id;
        }
        get(id) {
            if (this.has(id)) {
                return this._objMap.get(id);
            }
            else {
                alert("Failed to find obj: " + id.toString());
                return null;
            }
        }
        has(id) {
            return this._objMap.has(id);
        }
        remove(id) {
            if (this.has(id)) {
                this._objMap.delete(id);
                //Remove the object from the window
                delete window[this.getObjIDStr(id)];
            }
        }
        getObjIDStr(id) {
            return FilamentObjectManager.OBJ_PREFIX + id.toString();
        }
    }
    FilamentObjectManager.OBJ_PREFIX = "FILAMENT_API_OBJ_"; // THIS NEEDS TO MATCH THE STRING IN FilamentAPI.cs in PlatformBase
    SketchRenderAPI.FilamentObjectManager = FilamentObjectManager;
    class FilamentAPI {
        constructor() {
        }
        isInitialized() {
            return window.FilamentInitialized;
        }
        init(assets, canvas) {
            this._assets = assets;
            Filament.init(assets, () => {
                console.log("Filament Initialized!");
                window.FilamentInitialized = true;
            });
            if (assets.length == 0) {
                window.FilamentInitialized = true;
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
        getFilamentPrimType(sktPrimType) {
            return this._filamentPrimLUT[sktPrimType];
        }
        destory() {
            this.shutdown();
        }
        shutdown() {
            delete this._entityMgr;
            //TODO: When standard materials are setup add clean up code here
            //TODO: Clean up PlatformAPI when its setup
            delete this._engine;
        }
        loadMaterial(matType, buffer, bufferSize) {
            //TODO: Implement this 
        }
        createMaterialInstance(matType) {
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
        destoryMaterialInstance(platMatInstID) {
            var platMatInst = getObj(platMatInstID);
            if (platMatInst == null) {
                return;
            }
            this._engine.destroyMaterialInstance(platMatInst.getMaterialInstance());
            removeObj(platMatInstID);
        }
        //TODO: Get/Store platform objects in JS
        createTexture(path, texType) {
            //TODO: Implement this
        }
        //TODO: Get/Store platform objects in JS
        destroyTexture(platTexture) {
            //TODO: Implement this
        }
        createCamera() {
            var camera = this._engine.createCamera();
            var platCamera = new PlatformCamera(camera);
            return addObj(platCamera);
        }
        lookAt(platCamID, camPos, camLook, camUp) {
            var platCam = getObj(platCamID);
            if (platCam == null) {
                return;
            }
            platCam.lookAt(camPos, camLook, camUp);
        }
        setProjection(platCamID, fovInDegrees, aspectRatio, nearPlane, farPlane) {
            var platCam = getObj(platCamID);
            if (platCam == null) {
                return;
            }
            platCam.setProjection(fovInDegrees, aspectRatio, nearPlane, farPlane);
        }
        destoryCamera(platCameraID) {
            var platCamera = getObj(platCameraID);
            if (platCamera == null) {
                return;
            }
            this._engine.destroyCamera(platCamera.getCamera());
            removeObj(platCameraID);
        }
        createRenderContext() {
            var swapChain = this._engine.createSwapChain();
            var renderer = this._engine.createRenderer();
            var renderContext = new PlatformRenderContext(swapChain, renderer);
            return addObj(renderContext);
        }
        destroyRenderContext(platContextID) {
            var platContext = getObj(platContextID);
            if (platContext == null) {
                return;
            }
            this._engine.destroyRenderer(platContext.getRenderer());
            this._engine.destroySwapChain(platContext.getSwapChain());
            removeObj(platContextID);
        }
        render(platRenderContextID, platViewID) {
            var platRenderContext = getObj(platRenderContextID);
            var platView = getObj(platViewID);
            if (platRenderContext == null || platView == null) {
                return null;
            }
            platRenderContext.render(platView.getView());
        }
        createScene() {
            var scene = this._engine.createScene();
            var platScene = new PlatformScene(scene);
            return addObj(platScene);
        }
        destroyScene(platSceneID) {
            var platScene = getObj(platSceneID);
            if (platScene == null) {
                return;
            }
            this._engine.destroyScene(platScene.getScene());
            removeObj(platSceneID);
        }
        addMeshToScene(platSceneID, platMeshID) {
            var platScene = getObj(platSceneID);
            var platMesh = getObj(platMeshID);
            if (platScene == null || platMesh == null) {
                return;
            }
            if (this._entityMgr.hasEntity(platMesh.getEntityID())) {
                var meshEntity = this._entityMgr.getEntity(platMesh.getEntityID());
                platScene.getScene().addEntity(meshEntity);
            }
        }
        removeMeshFromScene(platSceneID, platMeshID) {
            var platScene = getObj(platSceneID);
            var platMesh = getObj(platMeshID);
            if (platScene == null || platMesh == null) {
                return;
            }
            if (this._entityMgr.hasEntity(platMesh.getEntityID())) {
                var meshEntity = this._entityMgr.getEntity(platMesh.getEntityID());
                platScene.getScene().remove(meshEntity);
            }
        }
        addIndirectLightToScene(platSceneID, platLightID) {
            var platScene = getObj(platSceneID);
            var platLight = getObj(platLightID);
            if (platScene == null || platLight == null) {
                return;
            }
            platScene.getScene().setIndirectLight(platLight.getIndirectLight());
        }
        removeIndirectLightFromScene(platSceneID) {
            var platScene = getObj(platSceneID);
            if (platScene == null) {
                return;
            }
            platScene.getScene().setIndirectLight(null);
        }
        addLightToScene(platSceneID, platLightID) {
            var platScene = getObj(platSceneID);
            var platLight = getObj(platLightID);
            if (platScene == null || platLight == null) {
                return;
            }
            if (this._entityMgr.hasEntity(platLight.getEntityID())) {
                var lightEntity = this._entityMgr.getEntity(platLight.getEntityID());
                platScene.getScene().addEntity(lightEntity);
            }
        }
        removeLightFromScene(platSceneID, platLightID) {
            var platScene = getObj(platSceneID);
            var platLight = getObj(platLightID);
            if (platScene == null || platLight == null) {
                return;
            }
            if (this._entityMgr.hasEntity(platLight.getEntityID())) {
                var lightEntity = this._entityMgr.getEntity(platLight.getEntityID());
                platScene.getScene().remove(lightEntity);
            }
        }
        addSkyboxToScene(platSceneID, platSkyboxID) {
            var platScene = getObj(platSceneID);
            var platSkybox = getObj(platSkyboxID);
            if (platScene == null || platSkybox == null) {
                return;
            }
            platScene.getScene().setIndirectLight(platSkybox.getIndirectLight().getIndirectLight());
            platScene.getScene().setSkybox(platSkybox.getSkybox());
        }
        removeSkyboxFromScene(platSceneID, platSkyboxID) {
            var platScene = getObj(platSceneID);
            var platSkybox = getObj(platSkyboxID);
            if (platScene == null || platSkybox == null) {
                return;
            }
            platScene.getScene().setIndirectLight(null);
            platScene.getScene().setSkybox(null);
        }
        createViewport(left, top, width, height) {
            var dpr = window.devicePixelRatio; //Handles the browsers zoom level
            var viewport = new PlatformViewport(left * dpr, top * dpr, width * dpr, height * dpr);
            return addObj(viewport);
        }
        destroyViewport(platViewportID) {
            removeObj(platViewportID);
        }
        createView() {
            var view = this._engine.createView();
            var platView = new PlatformView(view, this._canvas);
            return addObj(platView);
        }
        destroyView(platViewID) {
            var platView = getObj(platViewID);
            if (platView == null) {
                return;
            }
            this._engine.destroyView(platView.getView());
            platView.setCamera(null);
            platView.setScene(null);
            platView.setViewport(null);
            removeObj(platViewID);
        }
        setCamera(platViewID, platCamID) {
            var platView = getObj(platViewID);
            var platCam = getObj(platCamID);
            if (platView == null || platCam == null) {
                return;
            }
            platView.setCamera(platCam);
        }
        setScene(platViewID, platSceneID) {
            var platView = getObj(platViewID);
            var platScene = getObj(platSceneID);
            if (platView == null || platScene == null) {
                return;
            }
            platView.setScene(platScene);
        }
        setViewport(platViewID, platViewportID) {
            var platView = getObj(platViewID);
            var platViewport = getObj(platViewportID);
            if (platView == null || platViewport == null) {
                return;
            }
            platView.setViewport(platViewport);
        }
        createVertexBuffer(format, numVerts) {
            var vertexBuffer = PlatformVertexBuffer.build(this._engine, format, numVerts);
            var platVertexBuffer = new PlatformVertexBuffer(format, vertexBuffer);
            return addObj(platVertexBuffer);
        }
        destroyVertexBuffer(platVertexBufferID) {
            var platVertexBuffer = getObj(platVertexBufferID);
            if (platVertexBuffer == null) {
                return;
            }
            platVertexBuffer.destory(this._engine);
            removeObj(platVertexBufferID);
        }
        setClearColor(platViewID, r, g, b) {
            var platView = getObj(platViewID);
            if (platView == null) {
                return;
            }
            platView.getView().setClearColor([r, g, b, 1.0]);
        }
        setVerticesPos(platVertexBufferID, sktPositions, srcOffset, offset, count) {
            var platVertexBuffer = getObj(platVertexBufferID);
            if (platVertexBuffer == null) {
                return false;
            }
            return platVertexBuffer.setVerticesPos(this._engine, sktPositions, srcOffset, offset, count);
        }
        setVerticesPosColor(platVertexBufferID, sktPositions, filColors, srcOffset, offset, count) {
            var platVertexBuffer = getObj(platVertexBufferID);
            if (platVertexBuffer == null) {
                return false;
            }
            return platVertexBuffer.setVerticesColor(this._engine, sktPositions, filColors, srcOffset, offset, count);
        }
        setVerticesPosUV0(platVertexBufferID, sktPositions, texCoords, offset, srcOffset, count) {
            var platVertexBuffer = getObj(platVertexBufferID);
            if (platVertexBuffer == null) {
                return false;
            }
            return platVertexBuffer.setVerticesUV0(this._engine, sktPositions, texCoords, srcOffset, offset, count);
        }
        setVerticesPosUV0Tan(platVertexBufferID, sktPositions, normal, texCoords, srcOffset, offset, count) {
            var platVertexBuffer = getObj(platVertexBufferID);
            if (platVertexBuffer == null) {
                return false;
            }
            return platVertexBuffer.setVerticesTan(this._engine, sktPositions, texCoords, normal, srcOffset, offset, count);
        }
        setVerticesPosUV0Tan2(platVertexBufferID, sktPositions, normal, texCoords, offset, count, localIndices) {
            //TODO: Figure out how this is supposed to work
            return this.setVerticesPosUV0Tan(platVertexBufferID, sktPositions, normal, texCoords, 0, offset, count);
        }
        setVerticesScreenSpace(platVertexBufferID, sktPositions, texCoords, srcOffset, offset, count) {
            //TODO: Figure out how to do these versions of setVertices correctly
            //return this.setVerticesPos(platVertexBufferID, sktPositions, srcOffset, offset, count);
            return true;
        }
        createIndexBuffer(numIndices) {
            var indexBuffer = PlatformIndexBuffer.build(this._engine, numIndices);
            var platIndexBuffer = new PlatformIndexBuffer(indexBuffer);
            return addObj(platIndexBuffer);
        }
        destroyIndexBuffer(platIndexBufferID) {
            var platIndexBuffer = getObj(platIndexBufferID);
            if (platIndexBuffer == null) {
                return;
            }
            platIndexBuffer.destroy(this._engine);
            removeObj(platIndexBufferID);
        }
        setIndices(platIndexBufferID, indices, offset, numIndices) {
            var platIndexBuffer = getObj(platIndexBufferID);
            if (platIndexBuffer == null) {
                return false;
            }
            platIndexBuffer.setIndices(this._engine, indices, offset, numIndices);
            return true;
        }
        createBoundingBox(sktMin, sktMax) {
            var box = new Box();
            var platBox = new PlatformBoundingBox(box);
            platBox.set(sktMin, sktMax);
            return addObj(platBox);
        }
        createBoundingBoxPts(sktPoints) {
            var box = new Box();
            var platBox = new PlatformBoundingBox(box);
            platBox.compute(sktPoints);
            return addObj(platBox);
        }
        destroyBoundingBox(platBoxID) {
            var platBox = getObj(platBoxID);
            if (platBox == null) {
                return;
            }
            removeObj(platBoxID);
        }
        createMeshPrim(primType, platVertexBufferID, platIndexBufferID, offset, count, platMatInstID, platBBoxID, castShadows, receiveShadows) {
            var platMatInst = getObj(platMatInstID);
            if (platMatInst == null) {
                return -1; //TODO: Maybe return something else in these cases
            }
            var subMeshes = [
                addObj(new PlatformMeshSubGeometry(primType, offset, count, platMatInst)),
            ];
            return this.createMeshNew(platVertexBufferID, platIndexBufferID, subMeshes, platBBoxID, castShadows, receiveShadows);
        }
        createMeshNew(platVertexBufferID, platIndexBufferID, subMeshIDs, platBBoxID, castShadows, receiveShadows) {
            return this.createMesh(EntityID.ENTID_NULL, platVertexBufferID, platIndexBufferID, subMeshIDs, platBBoxID, castShadows, receiveShadows);
        }
        createMesh(entityID, platVertexBufferID, platIndexBufferID, subMeshIDs, platBBoxID, castShadows, receiveShadows) {
            const MAX_SUB_MESHES = 4;
            var vertexBuff = getObj(platVertexBufferID);
            var indexBuff = getObj(platIndexBufferID);
            var bbox = getObj(platBBoxID);
            if (vertexBuff == null || indexBuff == null || bbox == null) {
                alert("Failed to create mesh!");
                return -1;
            }
            var subMeshes = new Array(subMeshIDs.length);
            for (var i = 0; i < subMeshIDs.length; i++) {
                var subMesh = getObj(subMeshIDs[i]);
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
        createMeshSubGeometry(primType, outlineOffset, outlineCount, outlineMatInstID) {
            var matInst = getObj(outlineMatInstID);
            if (matInst == null) {
                return -1;
            }
            var mesh = new PlatformMeshSubGeometry(primType, outlineOffset, outlineCount, matInst);
            return addObj(mesh);
        }
        reuseMesh(platMeshID, platVertexBufferID, platIndexBufferID, subMeshIDs, platBBoxID, castShadows, receiveShadows) {
            var mesh = getObj(platMeshID);
            var entityID = EntityID.ENTID_NULL;
            if (mesh != null) {
                entityID = mesh.getEntityID();
            }
            return this.createMesh(entityID, platVertexBufferID, platIndexBufferID, subMeshIDs, platBBoxID, castShadows, receiveShadows);
        }
        destroyMesh(platMeshID) {
            var mesh = getObj(platMeshID);
            if (mesh == null) {
                return;
            }
            //TODO: make sure material instances are cleaned up
            this._entityMgr.destroy(mesh.getEntityID());
            mesh.setEntityID(EntityID.ENTID_NULL);
            removeObj(platMeshID);
        }
        setTransformSkt(platMeshID, sktTransform) {
            var conv = FilamentUnits.convertMatSktToFil(sktTransform);
            this.setTransform(platMeshID, conv);
        }
        setTransformUnmodified(platMeshID, transform) {
            this.setTransform(platMeshID, transform);
        }
        setTransform(platMeshID, transform) {
            var platMesh = getObj(platMeshID);
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
                var mat4 = transform.reduce((acc, val) => acc.concat(val), []); //Flatten the array
                transformMgr.setTransform(inst, mat4);
            }
            else {
                this._engine.getTransformManager().create(meshEntity);
            }
        }
        setMaterial(platMeshID, subMeshIndex, platMatInstID) {
            var platMesh = getObj(platMeshID);
            var platMat = getObj(platMatInstID);
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
        createSkybox(indirectLightType) {
            //TODO: Use the indirectLightType to pick a skybox
            var indLight = this._engine.createIblFromKtx(this._assets[1]);
            var transform = FilamentUnits.SKETCH_COORDS_TO_FILAMENT_COORDS_MAT;
            indLight.setRotation(transform);
            var skybox = this._engine.createSkyFromKtx(this._assets[0]);
            var platIndirectLight = new PlatformIndirectLight(indLight, indirectLightType);
            var platSkybox = new PlatformSkybox(skybox, platIndirectLight);
            return addObj(platSkybox);
        }
        destroySkybox(platSkyboxID) {
            var platSkybox = getObj(platSkyboxID);
            if (platSkybox == null) {
                return;
            }
            removeObj(platSkyboxID);
            this._engine.destroySkybox(platSkybox.getSkybox());
            this._engine.destroyIndirectLight(platSkybox.getIndirectLight().getIndirectLight());
        }
        createIndirectLight(lightType) {
            var indLight = PlatformIndirectLight.build(this._engine, lightType);
            var transform = FilamentUnits.SKETCH_COORDS_TO_FILAMENT_COORDS_MAT;
            indLight.setRotation(transform);
            var light = new PlatformIndirectLight(indLight, lightType);
            return addObj(light);
        }
        createIndirectLightCubemap(lightType, cubemapID) {
            var cubemap = getObj(cubemapID);
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
        destroyIndirectLight(platLightID) {
            var light = getObj(platLightID);
            if (light == null) {
                return;
            }
            this._engine.destroyIndirectLight(light.getIndirectLight());
            removeObj(platLightID);
        }
        createLightDirectional(r, g, b, intensity, direction, castsShadows) {
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
        createLightSun(r, g, b, intensity, direction, castsShadows) {
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
        destroyLight(platLightID) {
        }
        getLightInstance(platLightID) {
            var platLight = getObj(platLightID);
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
        lightColor(platLightID, r, g, b) {
            var inst = this.getLightInstance(platLightID);
            if (inst == null) {
                return;
            }
            this._engine.getLightManager().setColor(inst, [r, g, b]);
        }
        lightIntensity(platLightID, intensity) {
            var inst = this.getLightInstance(platLightID);
            if (inst == null) {
                return;
            }
            this._engine.getLightManager().setIntensity(inst, intensity);
        }
        indirectLightIntensity(platLightID, intensity) {
            var platLight = getObj(platLightID);
            if (platLight == null) {
                return;
            }
            platLight.setIntensity(intensity);
        }
        lightDirection(platLightID, direction) {
            var inst = this.getLightInstance(platLightID);
            if (inst == null) {
                return;
            }
            this._engine.getLightManager().setDirection(inst, direction);
        }
        convert(sktVal) {
            return FilamentUnits.convertFloatSktToFil(sktVal);
        }
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
            console.log("engine.createView()");
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
    SketchRenderAPI.FilamentAPI = FilamentAPI;
})(SketchRenderAPI || (SketchRenderAPI = {}));
//Create an instance of FilamentAPI and store it in the window
window.FilamentInitialized = false;
window.FilamentObjectManager = new SketchRenderAPI.FilamentObjectManager();
window.FilamentAPI = new SketchRenderAPI.FilamentAPI();
//# sourceMappingURL=FilamentApi.js.map


