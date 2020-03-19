
class FilamentUnits {

    SKETCH_UNITS_TO_FILAMENT_UNITS = 1.0 / 5000.0;
    SKETCH_UNITS_TO_FILAMENT_UNITS_TO_SKETCH_UNITSFILAMENT_UNITS = 5000.0;

    static convertPtSktToFil(sktPt) {
        return [
            convertFloatSktToFil(sktPt[0]),
            convertFloatSktToFil(sktPt[1]),
            convertFloatSktToFil(sktPt[2])
        ];
    }

    static convertSktToFil(sktVal) {
        return sktVal * SKETCH_UNITS_TO_FILAMENT_UNITS;
    }
}

class FilamentEntityManager {
    constructor() {
        this._entityMap = new Map();
        this._idManager = new EntityIdManager();
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
        const entity = this._entityMap.get(id);
        Filament.EntityManager.get().destroy(entity);
        this._entityMap.delete(id);
    }

    //To simulate passing by reference use an object to wrap the entity
    getEntity(id, entityWrapper) {
        if (this._entityMap.has(id)) {
            entityWrapper.entity = this._entityMap.get(id);
            return true;
        }
        else {
            entityWrapper.entity = null;
            return false;
        }
    }
}

//We don't have access to the Entity.getId so this is here to replicate the functionality
class EntityIdManager {
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

class FilamentCamera {

    ONE_METER = 5000.0;
    DEFAULT_FOV = 45.0;
    DEFAULT_ASPECT_RATIO = 16.0 / 9.0;
    DEFAULT_NEAR_PLANE = ONE_METER * 0.05;
    DEFAULT_FAR_PLANE = ONE_METER * 1000.0;

    constructor(camera) {
        this._camera = camera;
    }

    initialize() {
        this.setProjection(DEFAULT_FOV, DEFAULT_ASPECT_RATIO, DEFAULT_NEAR_PLANE, DEFAULT_FAR_PLANE);
        const pos = [0, 0, this.ONE_METER];
        const lookPos = [0, this.ONE_METER, this.ONE_METER];
        const upVec = [0, 0, 1.0];
        this.lookAt(pos, lookPos, upVec);
    }

    lookAt(sktEye, sktCenter, sktUp) {
        const eye = FilamentUnits.convertPtSktToFil(sktEye);
        const center = FilamentUnits.convertPtSktToFil(sktCenter);
        const up = FilamentUnits.convertPtSktToFil(sktUp);
        this._camera.lookAt(eye, center, up);
    }

    setProjection(fovInDegrees, aspect, near, far) {
        this._camera.setProjectionFov(fovInDegrees, aspect, near, far, Filament.Camera$Fov.VERTICAL);
    }

    setModelMatrix(sktMat) {

        var modelMat = [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ];

        // Copy most of the matrix components
        for (row = 0; row < 3; ++row) {
            for (col = 0; col < 4; ++col) {
                matVal = sktMat[row][col];
                modelMat[row][col] = matVal;
            }
        }

        // Convert the positions as we copy them
        var sktPos = [sktMat[3][0], sktMat[3][1], sktMat[3][2]];
        var convPos = FilamentUnits.convertPtSktToFil(sktPos);// convert this way, rather than per-component to allow coordinate system conversion to happen
        modelMat[3][0] = convPos.x;
        modelMat[3][1] = convPos.y;
        modelMat[3][2] = convPos.z;

        // Copy the last value directly
        modelMat[3][3] = sktMa[3][3];

        // Flattens the 2d array into a single array which filament expects
        var flattened = modelMat.reduce((acc, val) => acc.concat(val), []);
        this._camera.setModelMatrix(flattened);

    }

    get camera() { return this._camera; }

}

class FilamentRenderContext {
    constructor(swapChain, renderer) {
        this._swapChain = swapChain;
        this._renderer = renderer;
    }

    render(view) {
        this._renderer.render(this._swapChain, view);
    }

    get swapChain() { return this._swapChain; }

    get renderer() { return this._renderer; }
}

class FilamentScene {
    constructor(scene) {
        this._scene = scene;
    }

    get scene() { return this._scene; }
}

class FilamentIndirectLight {
    constructor(indirectLight, lightType) {
        this._indrectLight = indirectLight;
        this._lightType = lightType;
    }

    get indirectLight() { return this._indrectLight; }
    get lightType() { return this._lightType; }

    setIntensity(intensity) {
        this._indrectLight.setIntensity(intensity);
    }

    // static getCoefficients(lightType) {
    //     var coefficents = [];
    //     switch (lightType) {
    //         case 0:
    //             return this.noonGrassCoef;
    //         case 1:
    //             return this.defaultSky;
    //     }
    // }

    // static noonGrassCoef = [
    //     [0.623220127315220, 0.886922625176132, 1.255084767605070], // L00
    //     [-0.210521732019477, -0.270994631349530, -1.099017699677069], // L1-1
    //     [0.031589825992246, 0.058418596454591, 0.159860525707438], // L10
    //     [-0.002709596838855, 0.015904246634819, 0.028695913735464], // L11
    //     [0.016667782987820, 0.026230409311113, 0.010163630191357], // L2-2
    //     [-0.040963502607874, -0.050351523406741, -0.101756407860318], // L2-1
    //     [-0.136296161919919, -0.140777720274997, -0.183877580383222], // L20
    //     [-0.034435148087843, -0.051731329734875, -0.113001255527486], // L21
    //     [-0.294609334103497, -0.345042383380244, -0.550035456175430] // L22
    // ];

    // static defaultSky = [
    //     [0.141066506505013, 0.197123527526855, 0.276795238256454], // L00, irradiance, pre-scaled base
    //     [0.072390265762806, 0.103876881301403, 0.156512156128883], // L1-1, irradiance, pre-scaled base
    //     [0.063869304955006, 0.063231356441975, 0.054513353854418], // L10, irradiance, pre-scaled base
    //     [-0.000092935544671, -0.000090501533123, -0.000075172538345], // L11, irradiance, pre-scaled base
    //     [-0.000064971463871, -0.000062444407376, -0.000052137147577], // L2-2, irradiance, pre-scaled base
    //     [0.046360768377781, 0.046224053949118, 0.040980271995068], // L2-1, irradiance, pre-scaled base
    //     [0.012738375924528, 0.014827484264970, 0.014651766978204], // L20, irradiance, pre-scaled base
    //     [-0.000092597409093, -0.000097549986094, -0.000084446102846], // L21, irradiance, pre-scaled base
    //     [0.007213938049972, 0.011694642715156, 0.015440320596099] // L22, irradiance, pre-scaled base
    // ];
}

class FilamentLight {
    constructor(lightType, entityID) {
        this._lightType = lightType;
        this._entityID = entityID;
    }

    get lightType() { return this._lightType; }
    get entityID() { return this._entityID; }
}

class FilamentView {

}

class FilamentAPI {

    constructor() {
    }

    init(assets, canvas) {
        this.assets = assets;
        Filament.init(assets);

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

        this._entityMgr = new FilamentEntityManager();
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
        //TODO: Implement this
    }

    destoryMaterialInstance(matInst) {
        if (matInst == null) {
            return;
        }
        this._engine.destroyMaterialInstance(matInst);
    }

    createTexture(path, texType) {
        //TODO: Implement this
    }

    destroyTexture(platTexture) {
        //TODO: Implement this
    }

    createCamera() {
        var camera = this._engine.createCamera();
        var platCamera = new FilamentCamera(camera);
        return platCamera;
    }

    destoryCamera(platCamera) {
        if (platCamera == null) {
            return;
        }
        this._engine.destroyCamera(platCamera.camera);
    }

    createRenderContext() {
        var swapChain = this._engine.createSwapChain();
        var renderer = this._engine.createRenderer();
        var renderContext = new FilamentRenderContext(swapChain, renderer);
        return renderContext;
    }

    destroyRenderContext(platContext) {
        if (platContext == null) {
            return;
        }
        this._engine.destroyRenderer(platContext.renderer);
        this._engine.destroySwapChain(platContext.swapChain);
    }

    createScene() {
        var scene = this._engine.createScene();
        var platScene = new FilamentScene(scene);
        return platScene;
    }

    destroyScene(platScene) {
        if (platScene == null) {
            return;
        }
        this._engine.destroyScene(platScene.scene);
    }

    addMeshToScene(platScene, platMesh) {
        if (platScene == null || platMesh == null) {
            return;
        }

        var entityWrapper = { entity: null };
        if (this._entityMgr.getEntity(platMesh.mesh.entityID, entityWrapper)) {
            var meshEntity = entityWrapper.entity;
            platScene.scene.addEntity(meshEntity)
        }
    }

    removeMeshFromScene(platScene, platMesh) {
        var entityWrapper = { entity: null };
        if (this._entityMgr.getEntity(platMesh.mesh.entityID, entityWrapper)) {
            var meshEntity = entityWrapper.entity;
            platScene.scene.remove(meshEntity);
        }
    }

    addIndirectLightToScene(platScene, platLight) {
        if (platScene == null || platLight == null) {
            return;
        }

        platScene.scene.setIndirectLight(platLight.indirectLight);
    }

    removeIndirectLightFromScene(platScene) {
        if (platScene == null) {
            return;
        }

        platScene.scene.setIndirectLight(null);
    }

    addLightToScene(platScene, platLight) {
        if (platScene == null || platLight == null) {
            return;
        }

        var entityWrapper = { entity: null };
        if (this._entityMgr.getEntity(platLight.light.entityID, entityWrapper)) {
            var lightEntity = entityWrapper.entity;
            platScene.scene.addEntity(lightEntity)
        }
    }

    removeLightFromScene(platScene, platLight) {
        var entityWrapper = { entity: null };
        if (this._entityMgr.getEntity(platLight.light.entityID, entityWrapper)) {
            var lightEntity = entityWrapper.entity;
            platScene.scene.remove(lightEntity);
        }
    }








    createTestScene() {
        //Create scene
        this.scene = this._engine.createScene();

        //Create camera
        this.camera = this._engine.createCamera();
        const ONE_METER = 5000.0;
        const eye = [2.0 * ONE_METER, 10.0 * ONE_METER, 2.5 * ONE_METER];
        const center = [0.0, 0.0, 2.5 * ONE_METER];
        const up = [0.0, 0.0, 1.0];
        this.camera.lookAt(eye, center, up);
        this.camera.setProjectionFov(45.0, this._canvas.width / this._canvas.height, ONE_METER * 0.05, ONE_METER * 1000.0, 0);

        //Create view
        this.view = this._engine.createView();
        this.view.setCamera(this.camera);
        this.view.setScene(this.scene);
        this.view.setClearColor([255.0, 0.0, 0.0, 255.0]);
        this.view.setViewport([0, 0, this._canvas.width, this._canvas.height])

        //Create swap chain
        this.swapChain = this._engine.createSwapChain();

        //Create renderer
        this.renderer = this._engine.createRenderer();

        //Create geometry
        var entity = Filament.EntityManager.get().create();
        this.scene.addEntity(entity);

        var vertices = new Float32Array([
            -5.0 * ONE_METER, 0.0, 0.0,
            -5.0 * ONE_METER, 0.0, 3.0 * ONE_METER,
            0.0, 0.0, 5.0 * ONE_METER,
            5.0 * ONE_METER, 0.0, 3.0 * ONE_METER,
            5.0 * ONE_METER, 0.0, 0.0
        ]);

        const VertexAttribute = Filament.VertexAttribute;
        const AttributeType = Filament.VertexBuffer$AttributeType;
        var vb = Filament.VertexBuffer.Builder()
            .bufferCount(1)
            .vertexCount(vertices.length)
            .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 12)
            .build(this._engine);
        vb.setBufferAt(this._engine, 0, vertices);

        var indicies = new Uint16Array([
            0, 1, 2,
            0, 2, 3,
            0, 3, 4,
        ]);

        var ib = Filament.IndexBuffer.Builder()
            .bufferType(Filament.IndexBuffer$IndexType.USHORT)
            .indexCount(9)
            .build(this._engine);
        ib.setBuffer(this._engine, indicies);

        Filament.RenderableManager.Builder(1)
            .boundingBox({
                center: [-1, -1, -1],
                halfExtent: [1, 1, 1]
            })
            .geometry(0, Filament.RenderableManager$PrimitiveType.TRIANGLES, vb, ib)
            .build(this._engine, entity);
    }

    render() {
        this.renderer.render(this.swapChain, this.view);
    }

    resize() {
        this.view.setViewport([0, 0, this._canvas.width, this._canvas.height]);
        this.camera.setProjectionFov(45, withis._canvas.widthdth / this._canvas.height, 1.0, 10.0, Filament.Camera$Fov.VERTICAL);
    }
}

//Create an instance of FilamentAPI and store it in the window
this.window.FilamentAPI = new FilamentAPI();
