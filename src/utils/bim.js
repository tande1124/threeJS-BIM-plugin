export const InsBimModelLoadStrategy = {
    SELF: 1,
    CHILDREN: 0,
    NONE: 2,
    ALL: 3
}

export const InsBimObjectType = {
    NOTSPECIFIED: -1,
    STRUCTURE: 0,
    MODELSET: 1,
    PROPERTYSET: 2,
    PBSTREE: 4,
    MODEL: 5,
    FILE: 6,
    DIRECTORY: 7,
    ATTACHMENTSET: 8,
    FILEDATA: 9
};

export const AttachmentType = {
    DOCUMENT: 0,
    DETAILMODEL: 1,
    MODEL: 2
};

export const LinkType = {
    BIM: 'BIM'
};

export const InsOperateType = {
    EXIST: 'EXIST'
};

export const InsBimLoadUnit = {
    METER: 'METER'
};

export const InsBimLodType = {
    AUTO: 'AUTO'
};

export const InsBimVisualStyle = {
    TEXTURED: 'TEXTURED'
};

export const InsBimMaterialType = {
    ORIGINAL: 'ORIGINAL'
};

export const OutputFormatType = {
    SVF: 'SVF'
};

export const InsBimLodLevel = {
    LOD200: 'LOD200',
    LOD300: 'LOD300'
};

export const InsDataType = {
    STRING: 'STRING'
};

export function newGuid() {
    let guid = "";
    for (let i = 1; i <= 32; i++) {
        let n = Math.floor(Math.random() * 16.0).toString(16);
        guid += n;
        if ((i == 8) || (i == 12) || (i == 16) || (i == 20))
            guid += "-";
    }
    return guid;
}

export function getStructure(pbsNodeData, pbsTreeDataMap, pbsTreeDataCodeMap, pbsTreeDataNameMap) {
    if (pbsNodeData) {
        const ret = {
            Children: [],
            Identify: {},
            Version: {},
            Info: {},
            AttachmentSet: null,
            ModelSet: null
        }
        ret.Identify.Name = pbsNodeData.Name;
        ret.Identify.DisplayName = pbsNodeData.DisplayName;
        ret.Identify.Code = pbsNodeData.Code;
        ret.Identify.Description = pbsNodeData.Description;
        ret.Version.VersionType = pbsNodeData.VersionType;
        ret.Version.VersionId = pbsNodeData.VersionId;
        ret.Version.VersionNo = pbsNodeData.VersionNo;
        ret.Version.CommitTime = pbsNodeData.CommitTime;
        ret.Info = pbsNodeData.Info;
        ret.StructureId = pbsNodeData.Id;
        ret.ModelSetVersion = pbsNodeData.ModelSetVersion;
        ret.PropertySetVersion = pbsNodeData.PropertySetVersion;
        ret.AttachmentSetVersion = 0;
        ret.LoadStrategy = !isNaN(pbsNodeData.LoadStrategy) ? pbsNodeData.LoadStrategy : InsBimModelLoadStrategy.CHILDREN;
        ret.ParentId = pbsNodeData.ParentId;
        ret.LevelCode = pbsNodeData.LevelCode;
        ret.PropertySet = pbsNodeData.PropertySet;
        ret.SiblingId = pbsNodeData.SiblingId;
        ret.ObjectType = InsBimObjectType.STRUCTURE;
        ret.Arguments = "home,pbstree,attrtable,clip,measure,split,about,viewcube";
        ret.AttachmentSet = getAttachmentSet(pbsNodeData);
        ret.ModelSet = getInsBimPbsStructureModelSet(pbsNodeData);
        pbsTreeDataMap && (pbsTreeDataMap[ret.StructureId] = ret);
        pbsTreeDataCodeMap && (pbsTreeDataCodeMap[ret.Identify.Code] = ret);
        pbsTreeDataNameMap && (pbsTreeDataNameMap[ret.Identify.Name] = ret);
        if (pbsNodeData.ChildNodes) {
            for (const child of pbsNodeData.ChildNodes) {
                ret.Children.push(getStructure(child, pbsTreeDataMap, pbsTreeDataCodeMap, pbsTreeDataNameMap));
            }
        }
        return ret;
    } else {
        return null;
    }
}

export function getAttachmentSet(pbsNodeData) {
    const ret = {
        ObjectType: InsBimObjectType.ATTACHMENTSET,
        StructureId: pbsNodeData?.Id,
        AttachmentSetId: newGuid(),
        Attachments: [],
        Version: {},
        Identify: {}
    }
    if (pbsNodeData) {
        ret.Identify.Name = pbsNodeData.Name;
        ret.Identify.DisplayName = pbsNodeData.DisplayName;
        ret.Identify.Code = pbsNodeData.Code;
        ret.Identify.Description = pbsNodeData.Description;
        ret.Version.VersionType = pbsNodeData.VersionType;
        ret.Version.VersionId = pbsNodeData.VersionId;
        ret.Version.VersionNo = pbsNodeData.VersionNo;
        ret.Version.CommitTime = pbsNodeData.CommitTime;
        ret.StructureId = pbsNodeData.Id;
        ret.AttachmentSetId = pbsNodeData.Id;
        if (pbsNodeData.Files) {
            for (const file of pbsNodeData.Files) {
                const fileWithModel = {
                    ...file,
                    AttachModel: pbsNodeData.Models?.find(m => m.Info?.MetaFileFileId === file.Info?.FileId)
                };
                const attachment = getInsBimPbsStructureAttachment(fileWithModel);
                ret.Attachments.push(attachment);
            }
        }
    }
    return ret
}

export function getInsBimPbsStructureAttachment(file) {
    const ret = {}
    ret.File = null;
    ret.FileId = file?.Id;
    ret.Type = AttachmentType.DOCUMENT;
    ret.BindTime = file?.BindTime ? new Date(file.BindTime) : null;
    ret.File = file ? getInsBimPbsStructureAttachmentFile(file) : null;
    ret.Type = file?.Type;
    return ret
}

export function getInsBimPbsStructureAttachmentFile(file){
    if (!file) return null;
    try{
        const ret = {
            ObjectType: InsBimObjectType.FILE,
            FileId: file.Id,
            ParentDirectoryId: file.ParentId,
            DataId: file.Info?.FileId,
            Affix: null,
            Md5: file.Info?.FileId,
            Auth: file.Auth,
            Info: file.Info,
            FileDatas: [],
            Version: {},
            Identify: {}
        }
        ret.Identify.Name = file.Name;
        ret.Identify.DisplayName = file.DisplayName;
        ret.Identify.Code = file.Code;
        ret.Identify.Description = file.Description;
        ret.Version.VersionType = file.VersionType;
        ret.Version.VersionId = file.VersionId;
        ret.Version.VersionNo = file.Version;
        ret.Version.CommitTime = file.Info?.CommitTime;

        if (file.Name) {
            const allNames = file.Name.split('.')
            const last = allNames.length - 1
            ret.Affix = allNames?.[last] ? allNames[last] : "other"
        }

        const fileData = getInsBimPbsStructureAttachmentFileData(file);
        ret.FileDatas.push(fileData);

        const foundFileData = getFileData(ret);
        if (foundFileData) {
            ret.Size = foundFileData.Size;
            ret.ConvertStats = foundFileData.ConvertStats;
            ret.AttachModel = foundFileData.AttachModel;
        }
        return ret
    }catch(e) {
        console.warn('转换structure节点的附件出错', e)
        return null
    }
}

export function getInsBimPbsStructureAttachmentFileData(data) {
    if (!data) return null;
    const ret = {
        ObjectType: InsBimObjectType.FILEDATA,
        FileId: data.Info?.FileId,
        DataId: data.Info?.FileId,
        Size: data.Info?.Size ? parseInt(data.Info.Size) : null,
        ConvertStats: data.CanPreview,
        AttachModel: null,
        Version: {},
        Identify: {}
    }
    ret.Identify.Name = data.Name;
    ret.Identify.DisplayName = data.DisplayName;
    ret.Identify.Code = data.Code;
    ret.Identify.Description = data.Description;
    ret.Version.VersionType = data.VersionType;
    ret.Version.VersionId = data.VersionId;
    ret.Version.VersionNo = data.Version;
    ret.Version.CommitTime = data.Info?.CommitTime;
    if (data.AttachModel) {
        ret.AttachModel = getInsBimModel(data.AttachModel);
    }
    return ret
}

export function getInsBimModel(data) {
    if (!data) return null;
    const ret = {
        _Id: data._Id,
        Version: {},
        Identify: {},
        ModelId: data.Id,
        AttachFileId: data.Info?.MetaFileFileId,
        File: data.File ? getInsBimPbsStructureAttachmentFile(data.File) : null,
        DbidList: data.DbidList,
        Info: data.Info,
        LodType: data.LodType,
        VisualStyle: data.VisualStyle,
        Matrix: data.Matrix,
        LoadUnit: data.LoadUnit,
        Offset: data.Offset,
        MaterialType: data.MaterialType,
        MaterialColor: data.MaterialColor,
        ShowEdge: data.ShowEdge,
        IsBackground: data.IsBackground,
        OutputFormat: typeof data.OutputFormat === 'undefined' ? OutputFormatType.SVF : data.OutputFormat,
        F2dList: data.F2dList,
        ObjectType: InsBimObjectType.MODEL
    }
    ret.Identify.Name = data.Name;
    ret.Version.VersionType = data.VersionType;
    ret.Version.VersionId = data.VersionId;
    ret.Version.VersionNo = data.Version;
    ret.Version.CommitTime = data.Info?.ConvertTime;
    return ret
}

export function getInsBimLink(data, extensionString) {
    const optionalExtensionString = extensionString ?? 'home,pbstree,attrtable,clip,measure,split,about,viewcube';
    const ret = {
        LinkId: newGuid(),
        Identify: {},
        ProjectCode: null,
        RootStructure: null,
        Version: {},
        Arguments: optionalExtensionString,
        LoadStrategy: null,
        CameraState: null,
        LinkType: LinkType.BIM
    }
    if (data) {
        ret.Identify.Code = data.Code;
        ret.Identify.Name = data.Name;
        ret.Identify.ModelStage = data.ModelStage;
        ret.Identify.Remark = data.Remark;
        ret.LinkId = data.LinkId;
        ret.ProjectCode = data.StoreCode;
        ret.Arguments = data.Argument;
        ret.RootStructure = data.RootStructure;
        ret.LoadStrategy = data.LoadStrategy ? convertLoadStrategy(data.LoadStrategy) : {};
        ret.CameraState = data.CameraState ? JSON.parse(data.CameraState) : null;
        ret.Version.CommitTime = data.CommitTime;
        ret.Version.Author = data.Author;
    }
    return ret;
}

export function convertLoadStrategy(dataString) {
    let result;
    try {
        result = JSON.parse(dataString);
        if (typeof result === "string") {
            result = convertLoadStrategy(result);
        }
    } catch (e) {
        result = {};
    }
    return result;
}

export function getInsBimPbsTree(data, pbsTreeDataMap, pbsTreeDataCodeMap, pbsTreeDataNameMap) {
    const ret = {
        PbsTreeId: newGuid(),
        Root: null,
        ObjectType: InsBimObjectType.PBSTREE,
        Content: null,
        Identify: {},
        Version: {}
    }
    if (data) {
        ret._Id = data._Id;
        ret.Identify.Name = data.Name;
        ret.Identify.DisplayName = data.DisplayName;
        ret.Identify.Code = data.Code;
        ret.Identify.Description = data.Description;
        ret.Version.VersionType = data.VersionType;
        ret.Version.VersionId = data.VersionId;
        ret.Version.VersionNo = data.VersionNo;
        ret.Version.CommitTime = data.CommitTime;
        ret.PbsTreeId = data.Id;
        ret.Root = getStructure(data, pbsTreeDataMap, pbsTreeDataCodeMap, pbsTreeDataNameMap);
        ret.Content = data;
    } else {
        ret.Root = {
            Identify: { Name: "ROOT", Code: "ROOT" },
            LevelCode: "ROOT"
        }
    }
    return ret;
}

export function getInsBimPbsStructureModelSet(data) {
    window.globalModelSetSeq === undefined && (window.globalModelSetSeq = 0)
    const ret = {
        msId: window.globalModelSetSeq++,
        StructureId: null,
        ModelSetId: newGuid(),
        ModelSegmentList: [],
        ObjectType: InsBimObjectType.MODELSET,
        DefaultSegmentLod200: null,
        DefaultSegmentLod300: null,
        Version: {},
        Identify: {}
    }
    if (data) {
        ret._Id = data._Id;
        ret.Identify.Name = data.Name;
        ret.Identify.DisplayName = data.DisplayName;
        ret.Identify.Code = data.Code;
        ret.Identify.Description = data.Description;
        ret.Version.VersionType = data.VersionType;
        ret.Version.VersionId = data.VersionId;
        ret.Version.VersionNo = data.Version;
        ret.Version.CommitTime = data.Info ? data.Info.CommitTime : "";
        ret.StructureId = data.Id;
        ret.ModelSetId = data.Id;
        ret.DefaultSegmentLod200 = data.DefaultSegmentLod200;
        ret.DefaultSegmentLod300 = data.DefaultSegmentLod300;
        if (data.Models) {
            for (const modelData of data.Models) {
                const modelSegment = getInsBimPbsStructureModelSegment(modelData);
                if (modelData.IsDefault) {
                    ret.DefaultSegmentLod200 = modelSegment.ModelSegmentId;
                }
                ret.ModelSegmentList.push(modelSegment);
                ret.hasModelSegment = true
            }
        } else {
            console.log(data.Name + '没有任何模型数据', data)
        }
    }
    return ret;
}

export function getInsBimPbsStructureModelSegment(data) {
    if (!data) return null;
    return {
        ModelId: data.Id,
        DbidList: data.DbidList,
        ModelSegmentId: data.Id,
        LodLevel: InsBimLodLevel.LOD200,
        BindTime: new Date(),
        IsDefault: data.IsDefault,
        Name: data.Name
    };
}

export function getInsBimSvfProperty(data) {
    const ret = {
        Type: InsDataType.STRING,
        Name: null,
        Value: null,
        Unit: null,
        Category: null
    }
    if (data) {
        for (const prop in data) {
            ret[prop] = data[prop];
        }
    }
    return ret;
}

export function getInsBimSvfNode(data) {
    const ret = {
        Id: null,
        Dbid: null,
        Name: null,
        Children: [],
        Properties: []
    }
    if (data) {
        ret.Id = data.Id;
        ret.Dbid = data.Dbid;
        ret.Name = data.Name;
        if (data.Children) {
            for (const child of data.Children) {
                ret.Children.push(getInsBimSvfNode(child));
            }
        }
        if (data.Properties) {
            for (const prop of data.Properties) {
                ret.Properties.push(getInsBimSvfProperty(prop));
            }
        }
    }
    return ret;
}

export function getInsBimTile3D(option) {
    const ret = {
        option: option
    }
    ret.getId = function () {
        return this.option.id;
    }
    ret.isModel = function () {
        return this.option.isModel;
    }
    return ret;
}

export function getInsBimMarker(option) {
    const ret = {
        option: option
    }
    ret.getId = function () {
        return this.option.id;
    }
    return ret;
}

// 工具函数
export function exportLightStructure(structure) {
    if (!structure) return {};
    return {
        PropertySetVersion: structure.PropertySetVersion,
        ModelSetVersion: structure.ModelSetVersion,
        AttachmentSetVersion: structure.AttachmentSetVersion,
        StructureId: structure.StructureId,
        Version: structure.Version,
        Info: structure.Info,
        LoadStrategy: structure.LoadStrategy,
        Identify: structure.Identify,
        LevelCode: structure.LevelCode,
        ParentId: structure.ParentId,
        SiblingId: structure.SiblingId
    };
}

export function changeToExist(structure) {
    if (!structure) return;
    structure.Version = structure.Version || {};
    structure.Version.OperateType = InsOperateType.EXIST;
    if (structure.Children) {
        for (const child of structure.Children) {
            changeToExist(child);
        }
    }
}

export function addStructure(parent, structure) {
    if (!parent || !structure) return;
    parent.Children = parent.Children || [];
    parent.Children.push(structure);
    structure.ParentId = parent.StructureId;
    if (parent.Identify && parent.Identify.Code && structure.LevelCode) {
        structure.Identify = structure.Identify || {};
        structure.Identify.Code = parent.Identify.Code + '-' + structure.LevelCode;
    }
}

export function findStructureByCode(structure, code) {
    if (!structure) return null;
    if (structure.Identify && structure.Identify.Code === code) {
        return structure;
    }
    if (structure.Children) {
        for (const child of structure.Children) {
            const result = findStructureByCode(child, code);
            if (result) return result;
        }
    }
    return null;
}

export function getAllModelInfo(structure, modelInfos) {
    if (!structure) return modelInfos || [];
    modelInfos = modelInfos || [];
    if (structure.Children) {
        for (const child of structure.Children) {
            if (child && child.ModelSet && child.ModelSet.ModelSegmentList && child.ModelSet.ModelSegmentList.length) {
                const modelSegment = child.ModelSet.ModelSegmentList[0];
                if (modelSegment && modelInfos.findIndex(m => m.name === modelSegment.Name) === -1) {
                    modelInfos.push({name: modelSegment.Name, id: modelSegment.ModelSegmentId || modelSegment.ModelId});
                }
            }
            getAllModelInfo(child, modelInfos);
        }
    }
    return modelInfos;
}

export function initializeExtensionConfig(structure, extensionConfig) {
    if (structure && structure.Arguments && extensionConfig) {
        structure.Arguments = structure.Arguments.toLowerCase();
        const argArr = structure.Arguments.split(',').map(str => str?.trim());
        if (extensionConfig.optional) {
            for (const prop in extensionConfig.optional) {
                if (argArr.includes(prop)) {
                    extensionConfig.default = extensionConfig.default || {};
                    extensionConfig.default[prop] = extensionConfig.optional[prop];
                }
            }
        }
    }
}

export function getModelSegmentBySegmentId(modelSet, segmentId) {
    if (!modelSet || !modelSet.ModelSegmentList || !modelSet.ModelSegmentList.length) return null;
    for (const segment of modelSet.ModelSegmentList) {
        if (segment && segment.ModelSegmentId == segmentId) {
            return segment;
        }
    }
    return null;
}

export function getUsedModelSegment(modelSet, lodType) {
    if (!modelSet || !modelSet.ModelSegmentList) return null;
    if (lodType !== InsBimLodLevel.LOD300) {
        lodType = InsBimLodLevel.LOD200;
    }
    let segment = null;
    switch (lodType) {
        case InsBimLodLevel.LOD200:
            if (modelSet.DefaultSegmentLod200) {
                segment = modelSet.ModelSegmentList.find(x => x.ModelSegmentId == modelSet.DefaultSegmentLod200);
            }
            if (!segment) {
                segment = modelSet.ModelSegmentList.find(x => x.LodLevel == InsBimLodLevel.LOD200);
            }
            break;
        case InsBimLodLevel.LOD300:
            if (modelSet.DefaultSegmentLod300) {
                segment = modelSet.ModelSegmentList.find(x => x.ModelSegmentId == modelSet.DefaultSegmentLod300);
            }
            if (!segment) {
                segment = modelSet.ModelSegmentList.find(x => x.LodLevel == InsBimLodLevel.LOD300);
            }
            break;
    }
    return segment;
}

export function getAttachModel(file) {
    let model = null;
    try {
        if (file && file.FileDatas && file.DataId) {
            const fileData = file.FileDatas.find(x => x.DataId == file.DataId);
            if (fileData) {
                model = fileData.AttachModel;
            }
        }
    } catch (e) {
    }
    return model;
}

export function getFileData(file, dataId) {
    if (!file || !file.FileDatas) return null;
    if (!dataId) {
        dataId = file.DataId;
    }
    return file.FileDatas.find(x => x.DataId == dataId);
}

export function findSvfPropertyByName(node, name) {
    if (!node || !Array.isArray(node.Properties)) return null;
    return node.Properties.find(x => x.Name == name || x.attributeName == name);
}
