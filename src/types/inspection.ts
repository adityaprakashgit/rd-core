export type InspectionJob = {
  id: string;
  inspectionSerialNumber: string;
  companyId: string;
  jobReferenceNumber: string | null;
  clientName: string;
  commodity: string;
  plantLocation?: string | null;
  status: string;
  createdByUserId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  lots?: InspectionLot[];
  auditLogs?: AuditLog[];
};


export type InspectionLot = {
  id: string;
  jobId: string;
  lotNumber: string;
  totalBags: number;
  grossWeightKg?: number | null;
  netWeightKg?: number | null;
  createdAt: string | Date;
  sampling?: Sampling | null;
  bags?: InspectionBag[];
};

export type InspectionBag = {
  id: string;
  lotId: string;
  bagNumber: number;
  grossWeight?: number | null;
  netWeight?: number | null;
  createdAt: string | Date;
};

export type Sampling = {
  id: string;
  lotId: string;
  beforePhotoUrl?: string | null;
  duringPhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  createdAt: string | Date;
  [key: string]: any; // To allow dynamic indexing
};


export type HomogeneousSample = {
  id: string;
  jobId: string;
  photoUrl?: string | null;
  createdAt: string | Date;
  packets?: SamplePacket[];
};

export type SamplePacket = {
  id: string;
  sampleId: string;
  packetNumber: number;
};

export type RDTrial = {
  id: string;
  trialNumber: number;
  measurements: RDMeasurement[];
};

export type RDMeasurement = {
  id: string;
  element: string;
  value: number;
};

export type ReportSnapshot = {
  id: string;
  jobId: string;
  data: Record<string, any>; // Complex JSON data
  createdAt: string | Date;
};

export type AuditLog = {
  id: string;
  jobId: string;
  userId: string;
  action: string;
  from?: string | null;
  to?: string | null;
  notes?: string | null;
  createdAt: string | Date;
};


