"use client";

import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Class, Pupil, SchoolSettings, SubjectCommentType } from "@/types";
import { formatPupilDisplayName } from "@/lib/utils/name-formatter";

type PlayfulNurseryReportProps = {
  pupil: Pupil;
  pupilClass: Class | null;
  settings?: SchoolSettings | null;
  currentAcademicYear?: { name?: string; year?: number | string } | null;
  currentTerm?: { name?: string } | null;
  nextTermStartDate?: string | null;
  nextTermEndDate?: string | null;
  classTeacherComment?: string;
  headTeacherComment?: string;
  subjectComments?: Partial<Record<SubjectCommentType, string>>;
};

const comicReliefSource = process.env.NEXT_PUBLIC_PLAYFUL_REPORT_FONT_URL || "/fonts/ComicRelief-Regular.ttf";
Font.register({ family: "Comic Relief", src: comicReliefSource });

const nurseryAsset = (fileName: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_NURSERY_REPORT_ASSET_BASE_URL?.replace(/\/$/, "");
  const assetPath = `/Full Nursery/${fileName}`;
  return baseUrl ? `${baseUrl}${assetPath}` : assetPath;
};

const safeImageSource = (src?: string | null) => {
  if (!src || typeof src !== "string") return null;
  const trimmed = src.trim();
  return trimmed && (trimmed.startsWith("http") || trimmed.startsWith("data:") || trimmed.startsWith("/"))
    ? trimmed
    : null;
};

const calculateAge = (dateOfBirth?: string) => {
  if (!dateOfBirth) return "";
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthOffset = today.getMonth() - birthDate.getMonth();
  if (monthOffset < 0 || (monthOffset === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age > -1 ? `${age} years` : "";
};

const styles = StyleSheet.create({
  page: { position: "relative", backgroundColor: "#ffffff", fontFamily: "Helvetica", fontSize: 10, padding: 0 },
  background: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%" },
  pageSchoolName: { position: "absolute", top: 28, left: 103, right: 103, color: "#087337", fontSize: 18, fontFamily: "Helvetica-Bold", textAlign: "center", lineHeight: 21 },
  pageContact: { position: "absolute", top: 54, left: 105, right: 105, color: "#555555", fontSize: 10, fontFamily: "Helvetica", textAlign: "center", lineHeight: 11 },
  pageEmail: { position: "absolute", top: 67, left: 105, right: 105, color: "#555555", fontSize: 10, fontFamily: "Helvetica", textAlign: "center", lineHeight: 11 },
  content: { position: "absolute", left: 22, right: 22, top: 18, bottom: 18 },
  header: { height: 79, flexDirection: "row", alignItems: "center", position: "relative", overflow: "hidden" },
  logo: { width: 74, height: 74, objectFit: "contain", marginRight: 8 },
  logoPlaceholder: { width: 74, height: 74, marginRight: 8 },
  photoColumn: { width: 71, marginLeft: "auto", alignItems: "center" },
  pupilPhoto: { width: 57, height: 68, objectFit: "cover", borderWidth: 1.2, borderColor: "#4a9a50", borderRadius: 8 },
  admissionNumber: { marginTop: 2, color: "#666666", fontSize: 8, fontFamily: "Helvetica", textAlign: "center" },
  infoPanel: { height: 48, marginTop: 4, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: "rgba(255,255,255,0.82)", borderLeftWidth: 3, borderLeftColor: "#32CD32", borderRadius: 4 },
  infoRow: { flexDirection: "row", height: 18, alignItems: "center" },
  infoMetaRow: { flexDirection: "row", height: 17, alignItems: "center", borderTopWidth: 0.55, borderTopColor: "#72b965", borderTopStyle: "dotted" },
  infoCellName: { flex: 2, flexDirection: "row", alignItems: "center", minWidth: 0, paddingRight: 7 },
  infoCell: { flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0, paddingRight: 7 },
  infoMetaSmall: { width: "18%", flexDirection: "row", alignItems: "center", minWidth: 0 },
  infoMetaMedium: { width: "22%", flexDirection: "row", alignItems: "center", minWidth: 0 },
  infoMetaLarge: { flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0, justifyContent: "flex-end" },
  infoLabel: { color: "#006400", fontFamily: "Helvetica-Bold", fontSize: 10, marginRight: 5, flexShrink: 0 },
  infoValue: { flex: 1, minWidth: 0, color: "#0000FF", fontSize: 10, fontFamily: "Comic Relief" },
  reportTitle: { height: 19, marginTop: 5, color: "#087337", fontFamily: "Helvetica-Bold", fontSize: 12, letterSpacing: 0.3, textAlign: "center" },
  assessmentGrid: { marginTop: 4 },
  assessmentRow: { flexDirection: "row", gap: 12, marginBottom: 2 },
  assessmentItem: { flex: 1, position: "relative", paddingHorizontal: 2 },
  artwork: { position: "absolute", objectFit: "contain", zIndex: 3 },
  subjectHeader: { flexDirection: "row", alignItems: "center", height: 17 },
  numberBadge: { width: 17, height: 17, borderRadius: 9, alignItems: "center", justifyContent: "center", marginRight: 5 },
  number: { color: "#ffffff", fontSize: 10, fontFamily: "Helvetica-Bold" },
  subjectName: { flex: 1, fontSize: 10, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  commentArea: { position: "relative", marginTop: 1 },
  subjectComment: { position: "absolute", left: 0, color: "#0000FF", fontSize: 10.5, fontFamily: "Comic Relief", zIndex: 2 },
  dottedLine: { borderBottomWidth: 0.65, borderBottomColor: "#7d857c", borderBottomStyle: "dotted" },
  comments: { marginTop: 10 },
  commentsPanel: { height: 94, borderWidth: 1, borderColor: "#74b96d", borderRadius: 9, backgroundColor: "rgba(255,255,255,0.96)", paddingVertical: 5, paddingHorizontal: 11 },
  teacherCommentBlock: { position: "relative", height: 38 },
  teacherCommentLine: { position: "relative" },
  teacherCommentRule: { position: "absolute", left: 0, right: 0, bottom: 0, borderBottomWidth: 0.65, borderBottomColor: "#7d857c", borderBottomStyle: "dotted" },
  teacherCommentText: { position: "absolute", left: 0, right: 0, color: "#0000FF", fontSize: 9, fontFamily: "Comic Relief", zIndex: 2 },
  teacherCommentContinuation: { position: "absolute", left: 0, color: "#0000FF", fontSize: 9, fontFamily: "Comic Relief", zIndex: 2 },
  teacherCommentLabel: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  signatureRow: { position: "absolute", right: 0, bottom: 1, flexDirection: "row", alignItems: "center", gap: 5, zIndex: 3 },
  signatureLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  signatureLine: { width: 132, borderBottomWidth: 0.75, borderBottomColor: "#57605a" },
  commentsDivider: { height: 1, marginVertical: 2, borderBottomWidth: 0.55, borderBottomColor: "#a7c99a", borderBottomStyle: "dotted" },
  nextTerm: { height: 27, marginTop: 12, borderWidth: 1, borderColor: "#a5c96e", borderRadius: 8, backgroundColor: "rgba(255,255,255,0.96)", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  nextTermBlock: { flex: 1, flexDirection: "row", alignItems: "center" },
  nextTermLabel: { color: "#177134", fontSize: 10, fontFamily: "Helvetica-Bold" },
  nextTermValue: { flex: 1, marginLeft: 6, paddingBottom: 1, borderBottomWidth: 0.7, borderBottomColor: "#4e594e", color: "#0000FF", fontSize: 10, fontFamily: "Comic Relief" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 22, alignItems: "center" },
  footerText: { color: "#087337", fontFamily: "Helvetica-Bold", fontSize: 12, letterSpacing: 0.55 },
});

const palette = [
  { border: "#76b84d", text: "#37872f", badge: "#4f9c38" },
  { border: "#5aa6e4", text: "#3176b7", badge: "#3c84c4" },
  { border: "#f5aa35", text: "#e68a16", badge: "#ed981f" },
  { border: "#ef79ad", text: "#db4386", badge: "#e85093" },
  { border: "#af8cda", text: "#7756a8", badge: "#805cb1" },
  { border: "#54bfc1", text: "#258a8d", badge: "#329fa3" },
];

type SubjectLayout = {
  label: string;
  key: SubjectCommentType;
  artwork: string;
  lineCount: number;
  ruleHeight: number;
  commentTop: number;
  commentLineHeight: number;
  imageWidth: number;
  imageHeight: number;
  imageTop: number;
  imageRight: number;
};

const subjectLayouts: SubjectLayout[] = [
  { label: "Mathematical Concepts", key: "mathematical_concepts", artwork: "mathematical concepts.png", lineCount: 5, ruleHeight: 13.5, commentTop: -1, commentLineHeight: 1.286, imageWidth: 48, imageHeight: 33, imageTop: 3, imageRight: 4 },
  { label: "Writing Concepts", key: "writing_concepts", artwork: "writing concepts.png", lineCount: 4, ruleHeight: 13.5, commentTop: -1, commentLineHeight: 1.286, imageWidth: 46, imageHeight: 36, imageTop: 2, imageRight: 3 },
  { label: "Reading", key: "reading", artwork: "reading.png", lineCount: 4, ruleHeight: 13.5, commentTop: -1.5, commentLineHeight: 1.286, imageWidth: 48, imageHeight: 36, imageTop: 2, imageRight: 4 },
  { label: "Social / Emotional Development", key: "social_emotional_development", artwork: "social and emotional develoment.png", lineCount: 3, ruleHeight: 13.5, commentTop: -1, commentLineHeight: 1.286, imageWidth: 44, imageHeight: 36, imageTop: 0, imageRight: 3 },
  { label: "God and Creation", key: "god_and_his_creation", artwork: "God and creation.png", lineCount: 2, ruleHeight: 13.5, commentTop: -1, commentLineHeight: 1.286, imageWidth: 45, imageHeight: 34, imageTop: 0, imageRight: 4 },
  { label: "Life Skills", key: "life_skills", artwork: "life skils.png", lineCount: 3, ruleHeight: 13.5, commentTop: -1.5, commentLineHeight: 1.286, imageWidth: 40, imageHeight: 40, imageTop: 0, imageRight: 4 },
  { label: "Vocabulary", key: "vocabulary", artwork: "vocabulary.png", lineCount: 5, ruleHeight: 13.5, commentTop: -1, commentLineHeight: 1.286, imageWidth: 44, imageHeight: 38, imageTop: 2, imageRight: 4 },
  { label: "Story Telling", key: "story_telling", artwork: "story telling.png", lineCount: 3, ruleHeight: 13.5, commentTop: -1, commentLineHeight: 1.286, imageWidth: 48, imageHeight: 32, imageTop: 2, imageRight: 2 },
  { label: "General Knowledge", key: "general_knowledge", artwork: "general knowledge.png", lineCount: 3, ruleHeight: 13.5, commentTop: -1.5, commentLineHeight: 1.286, imageWidth: 38, imageHeight: 45, imageTop: 0, imageRight: 6 },
  { label: "Rhymes / Music", key: "rhymes_music", artwork: "rhymes, music.png", lineCount: 4, ruleHeight: 13.5, commentTop: -1, commentLineHeight: 1.286, imageWidth: 47, imageHeight: 39, imageTop: 1, imageRight: 2 },
  { label: "Outdoor Activities", key: "outdoor_activities", artwork: "outdoor activities.png", lineCount: 3, ruleHeight: 13.5, commentTop: -1, commentLineHeight: 1.286, imageWidth: 48, imageHeight: 35, imageTop: 1, imageRight: 2 },
  { label: "Punctuality", key: "punctuality", artwork: "punctuality.png", lineCount: 3, ruleHeight: 13.5, commentTop: -1.5, commentLineHeight: 1.286, imageWidth: 36, imageHeight: 40, imageTop: 0, imageRight: 6 },
];

function SubjectLineWrapper({ layout, comment, height }: { layout: SubjectLayout; comment?: string; height: number }) {
  const artworkAvoidance = layout.imageWidth + 8;
  const shortenedLineCount = Math.min(layout.lineCount, Math.ceil((layout.imageTop + layout.imageHeight) / layout.ruleHeight));
  return (
    <View style={[styles.commentArea, { height }]}>
      {Array.from({ length: layout.lineCount }, (_, lineIndex) => (
        <View
          key={`${layout.key}-line-${lineIndex}`}
          style={[
            styles.dottedLine,
            { height: layout.ruleHeight },
            lineIndex < shortenedLineCount ? { marginRight: artworkAvoidance } : {},
          ]}
        />
      ))}
      {!!comment && (
        <Text
          style={[
            styles.subjectComment,
            { top: layout.commentTop, right: artworkAvoidance, lineHeight: layout.commentLineHeight },
          ]}
        >
          {comment}
        </Text>
      )}
      <Image
        style={[
          styles.artwork,
          { right: layout.imageRight, top: layout.imageTop, width: layout.imageWidth, height: layout.imageHeight },
        ]}
        src={nurseryAsset(layout.artwork)}
      />
    </View>
  );
}

function SubjectAssessment({
  index,
  layout,
  comment,
  rowLineCount,
}: {
  index: number;
  layout: SubjectLayout;
  comment?: string;
  rowLineCount: number;
}) {
  const colour = palette[index % palette.length];
  return (
    <View style={styles.assessmentItem}>
      <View style={styles.subjectHeader}>
        <View style={[styles.numberBadge, { backgroundColor: colour.badge }]}><Text style={styles.number}>{index + 1}</Text></View>
        <Text style={[styles.subjectName, { color: colour.text }]}>{layout.label}</Text>
      </View>
      <SubjectLineWrapper layout={layout} comment={comment} height={rowLineCount * layout.ruleHeight} />
    </View>
  );
}

function splitTeacherComment(comment: string, firstLineLimit: number) {
  const words = comment.trim().split(/\s+/).filter(Boolean);
  const firstLine: string[] = [];
  while (words.length && `${firstLine.join(" ")} ${words[0]}`.trim().length <= firstLineLimit) {
    firstLine.push(words.shift()!);
  }
  return { firstLine: firstLine.join(" "), secondLine: words.join(" ") };
}

type TeacherCommentLayout = {
  key: "class-teacher" | "headteacher";
  title: string;
  colour: string;
  firstLineLimit: number;
  firstRuleHeight: number;
  secondRuleHeight: number;
  firstTextTop: number;
  secondTextTop: number;
  textLineHeight: number;
  signatureSpace: number;
};

const classTeacherCommentLayout: TeacherCommentLayout = {
  key: "class-teacher",
  title: "Class teacher's general comment:",
  colour: "#18723a",
  firstLineLimit: 78,
  firstRuleHeight: 16,
  secondRuleHeight: 16,
  firstTextTop: 0,
  secondTextTop: 0,
  textLineHeight: 1.3,
  signatureSpace: 170,
};

const headteacherCommentLayout: TeacherCommentLayout = {
  key: "headteacher",
  title: "Headteacher's comment:",
  colour: "#2f78bf",
  firstLineLimit: 92,
  firstRuleHeight: 16,
  secondRuleHeight: 16,
  firstTextTop: -0.25,
  secondTextTop: -0.25,
  textLineHeight: 1.3,
  signatureSpace: 170,
};

function TeacherCommentLineWrapper({
  layout,
  text,
  line,
}: {
  layout: TeacherCommentLayout;
  text: string;
  line: "first" | "signature";
}) {
  const isFirstLine = line === "first";
  const height = isFirstLine ? layout.firstRuleHeight : layout.secondRuleHeight;
  const textTop = isFirstLine ? layout.firstTextTop : layout.secondTextTop;
  return (
    <View style={[styles.teacherCommentLine, { height }]}>
      <View style={[styles.teacherCommentRule, !isFirstLine ? { right: layout.signatureSpace } : {}]} />
      {isFirstLine ? (
        <Text style={[styles.teacherCommentText, { top: textTop, lineHeight: layout.textLineHeight }]}>
          <Text style={[styles.teacherCommentLabel, { color: layout.colour }]}>{layout.title} </Text>{text}
        </Text>
      ) : (
        <>
          <Text style={[styles.teacherCommentContinuation, { top: textTop, right: layout.signatureSpace, lineHeight: layout.textLineHeight }]}>{text}</Text>
          <View style={styles.signatureRow}>
            <Text style={[styles.signatureLabel, { color: layout.colour }]}>Signature:</Text>
            <View style={styles.signatureLine} />
          </View>
        </>
      )}
    </View>
  );
}

function TeacherCommentBlock({ layout, comment }: { layout: TeacherCommentLayout; comment?: string }) {
  const lines = splitTeacherComment(comment || "", layout.firstLineLimit);
  return (
    <View style={styles.teacherCommentBlock}>
      <TeacherCommentLineWrapper layout={layout} text={lines.firstLine} line="first" />
      <TeacherCommentLineWrapper layout={layout} text={lines.secondLine} line="signature" />
    </View>
  );
}

export function PlayfulNurseryReportPageContent({
  pupil,
  pupilClass,
  settings,
  currentAcademicYear,
  currentTerm,
  nextTermStartDate,
  nextTermEndDate,
  classTeacherComment,
  headTeacherComment,
  subjectComments,
}: PlayfulNurseryReportProps) {
  const generalInfo = settings?.generalInfo;
  const contact = settings?.contact;
  const schoolLogo = safeImageSource(generalInfo?.logo);
  const pupilPhoto = safeImageSource(pupil.photo);
  const schoolName = generalInfo?.name?.toUpperCase() || "TRINITY FAMILY NUP AND PRI SCHOOL";
  const contacts = [contact?.phone, contact?.alternativePhone].filter(Boolean).join(" | ");
  const printDate = new Date().toLocaleDateString("en-GB");
  const year = currentAcademicYear?.year || currentAcademicYear?.name || new Date().getFullYear();

  return (
    <Page size="A4" style={styles.page}>
      <Image fixed src={nurseryAsset("background 2.png")} style={styles.background} />
      <Text style={styles.pageSchoolName}>{schoolName}</Text>
      <Text style={styles.pageContact}>{contacts ? `TEL: ${contacts}` : ""}</Text>
      <Text style={styles.pageEmail}>{contact?.email ? `EMAIL: ${contact.email}` : ""}</Text>
      <View style={styles.content}>
        <View style={styles.header}>
          {schoolLogo ? <Image src={schoolLogo} style={styles.logo} /> : <View style={styles.logoPlaceholder} />}
          <View style={styles.photoColumn}>
            {pupilPhoto ? <Image src={pupilPhoto} style={styles.pupilPhoto} /> : <View style={styles.pupilPhoto} />}
            <Text style={styles.admissionNumber}>{pupil.admissionNumber || pupil.learnerIdentificationNumber || ""}</Text>
          </View>
        </View>

        <View style={styles.infoPanel}>
          <View style={styles.infoRow}>
            <View style={styles.infoCellName}><Text style={styles.infoLabel}>NAME:</Text><Text style={styles.infoValue}>{formatPupilDisplayName(pupil)}</Text></View>
            <View style={styles.infoCell}><Text style={styles.infoLabel}>CLASS:</Text><Text style={styles.infoValue}>{pupilClass?.name || ""}</Text></View>
            <View style={styles.infoCell}><Text style={styles.infoLabel}>AGE:</Text><Text style={styles.infoValue}>{calculateAge(pupil.dateOfBirth)}</Text></View>
          </View>
          <View style={styles.infoMetaRow}>
            <View style={styles.infoMetaSmall}><Text style={styles.infoLabel}>YEAR:</Text><Text style={styles.infoValue}>{String(year)}</Text></View>
            <View style={styles.infoMetaMedium}><Text style={styles.infoLabel}>TERM:</Text><Text style={styles.infoValue}>{currentTerm?.name || ""}</Text></View>
            <View style={styles.infoMetaLarge}><Text style={styles.infoLabel}>PRINT DATE:</Text><Text style={styles.infoValue}>{printDate}</Text></View>
          </View>
        </View>

        <Text style={styles.reportTitle}>CHILD'S PROGRESSIVE ASSESSMENT REPORT</Text>

        <View style={styles.assessmentGrid}>
          {Array.from({ length: 6 }, (_, rowIndex) => {
            const left = subjectLayouts[rowIndex * 2];
            const right = subjectLayouts[rowIndex * 2 + 1];
            const rowLineCount = Math.max(left.lineCount, right.lineCount);
            return (
              <View key={left.key} style={[styles.assessmentRow, { height: 19 + rowLineCount * left.ruleHeight }]}>
                <SubjectAssessment index={rowIndex * 2} layout={left} rowLineCount={rowLineCount} comment={subjectComments?.[left.key]} />
                <SubjectAssessment index={rowIndex * 2 + 1} layout={right} rowLineCount={rowLineCount} comment={subjectComments?.[right.key]} />
              </View>
            );
          })}
        </View>

        <View style={styles.comments}>
          <View style={styles.commentsPanel}>
            <TeacherCommentBlock layout={classTeacherCommentLayout} comment={classTeacherComment} />
            <View style={styles.commentsDivider} />
            <TeacherCommentBlock layout={headteacherCommentLayout} comment={headTeacherComment} />
          </View>
        </View>

        <View style={styles.nextTerm}>
          <View style={styles.nextTermBlock}><Text style={styles.nextTermLabel}>Next Term begins on:</Text><Text style={styles.nextTermValue}>{nextTermStartDate || ""}</Text></View>
          <View style={[styles.nextTermBlock, { marginLeft: 18 }]}><Text style={styles.nextTermLabel}>Term Ends on:</Text><Text style={styles.nextTermValue}>{nextTermEndDate || ""}</Text></View>
        </View>
        <View style={styles.footer}><Text style={styles.footerText}>{generalInfo?.motto || "GUIDING GROWTH, INSPIRING GREATNESS"}</Text></View>
      </View>
    </Page>
  );
}

export default function PlayfulNurseryReport(props: PlayfulNurseryReportProps) {
  return <Document title={`Playful Report - ${formatPupilDisplayName(props.pupil)}`}><PlayfulNurseryReportPageContent {...props} /></Document>;
}
