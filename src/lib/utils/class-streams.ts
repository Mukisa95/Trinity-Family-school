import type {
  Class,
  ClassStream,
  ClassStreamConfiguration,
  ExamRecordPupilInfo,
  Pupil,
} from '@/types';

type ClassIdentity = Pick<Class, 'id' | 'name' | 'code' | 'streams' | 'streamConfigurations'>;
type PupilStreamIdentity = Pick<
  Pupil,
  'classId' | 'className' | 'classCode' | 'streamId' | 'streamName' | 'streamCode' | 'streamClassId'
>;

export type PupilClassDisplay = {
  name: string;
  code: string;
  baseName: string;
  baseCode: string;
  hasStream: boolean;
};

export type ClassStreamPupilStats = {
  total: number;
  isDistributed: boolean;
  streams: Array<{
    id: string;
    name: string;
    code: string;
    pupilCount: number;
  }>;
};

export function normaliseStreamValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function joinClassAndStream(baseValue: string, streamValue?: string): string {
  const base = normaliseStreamValue(baseValue || '');
  const stream = normaliseStreamValue(streamValue || '');
  if (!stream) return base;
  if (!base) return stream;
  return `${base} ${stream}`;
}

export function hasCurrentStreamAssignment(pupil: PupilStreamIdentity): boolean {
  return Boolean(
    pupil.streamId &&
    (pupil.streamName || pupil.streamCode) &&
    (!pupil.streamClassId || pupil.streamClassId === pupil.classId),
  );
}

/**
 * Resolve the pupil-facing class identity while keeping the Class document's
 * own name/code unchanged. Passing the class is preferred because it prevents
 * a stale denormalized pupil label from surviving a class rename.
 */
export function getPupilClassDisplay(
  pupil: PupilStreamIdentity,
  schoolClass?: Pick<ClassIdentity, 'id' | 'name' | 'code'> | null,
): PupilClassDisplay {
  const matchingClass = schoolClass && schoolClass.id === pupil.classId ? schoolClass : null;
  const baseName = matchingClass?.name || pupil.className || '';
  const baseCode = matchingClass?.code || pupil.classCode || '';
  const hasStream = hasCurrentStreamAssignment(pupil);

  return {
    baseName,
    baseCode,
    // Pupil records persist the composed label. Only append here when the
    // authoritative base Class document is available, preventing "East East"
    // if a caller only has the denormalized pupil record.
    name: hasStream && matchingClass ? joinClassAndStream(baseName, pupil.streamName) : baseName,
    code: hasStream && matchingClass ? joinClassAndStream(baseCode, pupil.streamCode) : baseCode,
    hasStream,
  };
}

export function enrichPupilClassIdentity<T extends Pupil>(
  pupil: T,
  schoolClass?: Pick<ClassIdentity, 'id' | 'name' | 'code'> | null,
): T {
  const display = getPupilClassDisplay(pupil, schoolClass);
  return {
    ...pupil,
    className: display.name,
    classCode: display.code,
  };
}

export function applyPupilClassIdentity<T extends Pupil>(
  pupil: T,
  schoolClass?: Pick<ClassIdentity, 'id' | 'name' | 'code'> | null,
): T {
  const display = getPupilClassDisplay(pupil, schoolClass);
  pupil.className = display.name;
  pupil.classCode = display.code;
  return pupil;
}

export function getStreamConfiguration(
  schoolClass: Pick<ClassIdentity, 'streamConfigurations'> | null | undefined,
  academicYearId?: string,
): ClassStreamConfiguration | undefined {
  const configurations = schoolClass?.streamConfigurations || [];
  if (!configurations.length) return undefined;
  if (academicYearId) {
    return configurations.find(configuration => configuration.academicYearId === academicYearId);
  }
  return [...configurations].sort((a, b) => b.configuredAt.localeCompare(a.configuredAt))[0];
}

export function getActiveClassStreams(
  schoolClass: Pick<ClassIdentity, 'streams' | 'streamConfigurations'> | null | undefined,
  academicYearId?: string,
): ClassStream[] {
  const configuration = getStreamConfiguration(schoolClass, academicYearId);
  if (!configuration?.enabled) return [];
  const byId = new Map((schoolClass?.streams || []).map(stream => [stream.id, stream]));
  return configuration.activeStreamIds
    .map(streamId => byId.get(streamId))
    .filter((stream): stream is ClassStream => Boolean(stream));
}

/**
 * Build the stream breakdown used by class overview cards. The breakdown is
 * only considered ready when every active pupil belongs to one of the streams
 * enabled for the selected academic year, preventing partial setup from being
 * presented as complete statistics.
 */
export function getClassStreamPupilStats(
  schoolClass: Pick<ClassIdentity, 'id' | 'streams' | 'streamConfigurations'>,
  pupils: Array<Pick<Pupil, 'classId' | 'status' | 'streamId' | 'streamClassId'>>,
  academicYearId?: string,
): ClassStreamPupilStats {
  const activePupils = pupils.filter(pupil => (
    pupil.classId === schoolClass.id && pupil.status === 'Active'
  ));
  const activeStreams = getActiveClassStreams(schoolClass, academicYearId);
  const activeStreamIds = new Set(activeStreams.map(stream => stream.id));
  const isDistributed = activePupils.length > 0
    && activeStreams.length > 0
    && activePupils.every(pupil => Boolean(
      pupil.streamId
      && activeStreamIds.has(pupil.streamId)
      && (!pupil.streamClassId || pupil.streamClassId === schoolClass.id),
    ));

  return {
    total: activePupils.length,
    isDistributed,
    streams: activeStreams.map(stream => ({
      id: stream.id,
      name: stream.name,
      code: stream.code,
      pupilCount: activePupils.filter(pupil => (
        pupil.streamId === stream.id
        && (!pupil.streamClassId || pupil.streamClassId === schoolClass.id)
      )).length,
    })),
  };
}

export function getExamPupilStreamId(pupil: ExamRecordPupilInfo): string | undefined {
  return pupil.streamIdAtExam;
}

export function filterExamPupilsByStream<T extends ExamRecordPupilInfo>(
  pupils: T[],
  streamId?: string | null,
): T[] {
  if (!streamId || streamId === 'all') return pupils;
  return pupils.filter(pupil => getExamPupilStreamId(pupil) === streamId);
}

export function assertUniqueStreams(streams: Array<Pick<ClassStream, 'id' | 'name' | 'code'>>): void {
  const names = new Set<string>();
  const codes = new Set<string>();
  streams.forEach(stream => {
    const name = normaliseStreamValue(stream.name).toLocaleLowerCase();
    const code = normaliseStreamValue(stream.code).toLocaleLowerCase();
    if (!name || !code) throw new Error('Every stream needs a name and code.');
    if (names.has(name)) throw new Error(`Stream name “${stream.name}” is already in use.`);
    if (codes.has(code)) throw new Error(`Stream code “${stream.code}” is already in use.`);
    names.add(name);
    codes.add(code);
  });
}
