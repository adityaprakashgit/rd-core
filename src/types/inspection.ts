export type PublicUser = {
  role: "ADMIN" | "OPERATIONS" | "RND" | "VIEWER";
  profile: {
    displayName: string;
    companyName?: string | null;
    jobTitle?: string | null;
    avatarUrl?: string | null;
  } | null;
};

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
  assignedToId?: string | null;
  assignedById?: string | null;
  assignedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  assignedTo?: PublicUser | null;
  assignedBy?: PublicUser | null;
  createdByUser?: PublicUser | null;
  lots?: InspectionLot[];
  auditLogs?: AuditLog[];
  reportSnapshots?: ReportSnapshot[];
};


export type InspectionLot = {
  id: string;
  jobId: string;
  companyId?: string;
  lotNumber: string;
  totalBags: number;
  grossWeightKg?: number | null;
  netWeightKg?: number | null;
  grossWeight?: number | null;
  tareWeight?: number | null;
  netWeight?: number | null;
  sealNumber?: string | null;
  sealAuto?: boolean;
  bagPhotoUrl?: string | null;
  samplingPhotoUrl?: string | null;
  sealPhotoUrl?: string | null;
  status?: string;
  assignedToId?: string | null;
  assignedById?: string | null;
  assignedAt?: string | Date | null;
  createdAt: string | Date;
  assignedTo?: PublicUser | null;
  assignedBy?: PublicUser | null;
  sampling?: Sampling | Sampling[] | null;
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
  companyId?: string;
  beforePhotoUrl?: string | null;
  duringPhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  status?: string;
  assignedToId?: string | null;
  assignedById?: string | null;
  assignedAt?: string | Date | null;
  createdAt: string | Date;
  assignedTo?: PublicUser | null;
  assignedBy?: PublicUser | null;
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
  data: Record<string, unknown>; // Complex JSON data
  createdAt: string | Date;
};

export type AuditLog = {
  id: string;
  jobId: string;
  userId: string;
  entity?: string;
  action: string;
  from?: string | null;
  to?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string | Date;
  user?: PublicUser | null;
};
