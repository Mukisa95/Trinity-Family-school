"use client";

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
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
  page: { position: "relative", backgroundColor: "#ffffff", fontFamily: "Helvetica", fontSize: 8.4, padding: 0 },
  background: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%" },
  pageSchoolName: { position: "absolute", top: 28, left: 105, right: 105, color: "#087337", fontSize: 17, fontFamily: "Helvetica-Bold", textAlign: "center", lineHeight: 19 },
  pageContact: { position: "absolute", top: 54, left: 105, right: 105, color: "#183523", fontSize: 7.6, fontFamily: "Helvetica-Bold", textAlign: "center", lineHeight: 9 },
  pageEmail: { position: "absolute", top: 65, left: 105, right: 105, color: "#183523", fontSize: 7.6, fontFamily: "Helvetica-Bold", textAlign: "center", lineHeight: 9 },
  content: { position: "absolute", left: 22, right: 22, top: 18, bottom: 18 },
  header: { height: 78, flexDirection: "row", alignItems: "center", position: "relative", overflow: "hidden" },
  logo: { width: 72, height: 72, objectFit: "contain", marginRight: 8 },
  logoPlaceholder: { width: 72, height: 72, marginRight: 8 },
  schoolInfo: { position: "absolute", left: 79, right: 74, top: 6, height: 64, alignItems: "center", paddingHorizontal: 4 },
  schoolNameWrap: { width: "100%", height: 24, overflow: "hidden" },
  schoolName: { width: "100%", color: "#087337", fontSize: 17, fontFamily: "Helvetica-Bold", textAlign: "center", lineHeight: 19 },
  contactWrap: { width: "100%", height: 24, marginTop: 5, overflow: "hidden" },
  contact: { width: "100%", color: "#183523", fontSize: 7.6, fontFamily: "Helvetica-Bold", textAlign: "center", lineHeight: 9 },
  photoColumn: { width: 71, marginLeft: "auto", alignItems: "center" },
  pupilPhoto: { width: 57, height: 68, objectFit: "cover", borderWidth: 1.2, borderColor: "#4a9a50", borderRadius: 8 },
  admissionNumber: { marginTop: 2, color: "#193320", fontSize: 7.5, fontFamily: "Helvetica-Bold", textAlign: "center" },
  infoPanel: { height: 58, marginTop: 7, borderWidth: 1, borderColor: "#4ca653", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11 },
  infoRow: { flexDirection: "row", flex: 1 },
  infoCell: { flex: 1, flexDirection: "row", alignItems: "center", borderRightWidth: 0.8, borderRightColor: "#8ecb72", paddingHorizontal: 5 },
  infoCellEnd: { flex: 1, flexDirection: "row", alignItems: "center", paddingLeft: 9 },
  infoLabel: { color: "#157237", fontFamily: "Helvetica-Bold", fontSize: 8 },
  infoValue: { flex: 1, minWidth: 0, marginLeft: 4, paddingBottom: 1, borderBottomWidth: 0.75, borderBottomColor: "#4d4d4d", color: "#1c2930", fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  reportBanner: { height: 35, marginTop: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#3a8b3b", borderWidth: 1.1, borderColor: "#176b32", borderRadius: 8 },
  reportBannerText: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 15.5, letterSpacing: 0.55, textAlign: "center" },
  assessmentGrid: { marginTop: 8 },
  assessmentRow: { flexDirection: "row", gap: 8, marginBottom: 5 },
  assessmentCard: { height: 61, flex: 1, flexDirection: "row", borderWidth: 1, borderRadius: 9, backgroundColor: "#ffffff", overflow: "hidden" },
  artworkBox: { width: 50, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fbf3", borderRightWidth: 0.5, borderRightColor: "#e1e8df" },
  artwork: { width: 43, height: 43, objectFit: "contain" },
  subjectBody: { flex: 1, paddingTop: 6, paddingRight: 8, paddingBottom: 5, paddingLeft: 6 },
  subjectHeader: { flexDirection: "row", alignItems: "center", height: 12 },
  numberBadge: { width: 15, height: 15, borderRadius: 8, alignItems: "center", justifyContent: "center", marginRight: 5 },
  number: { color: "#ffffff", fontSize: 8.1, fontFamily: "Helvetica-Bold" },
  subjectName: { flex: 1, fontSize: 8.2, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  commentArea: { position: "relative", marginTop: 4, height: 33 },
  subjectComment: { position: "absolute", top: 0, left: 0, right: 0, maxHeight: 30, color: "#28352a", fontSize: 7, lineHeight: 9 },
  dottedLine: { height: 10, borderBottomWidth: 0.65, borderBottomColor: "#7d857c", borderBottomStyle: "dotted" },
  comments: { marginTop: 1 },
  commentPanel: { height: 55, marginTop: 5, borderWidth: 1, borderRadius: 9, paddingTop: 6, paddingHorizontal: 11 },
  teacherCommentBlock: { position: "relative", height: 22 },
  teacherCommentText: { position: "absolute", top: 0, left: 0, right: 0, maxHeight: 20, color: "#28352a", fontSize: 7.8, lineHeight: 9.5 },
  teacherCommentLabel: { fontFamily: "Helvetica-Bold", fontSize: 8.3 },
  teacherCommentLines: { height: 20 },
  signatureRow: { position: "absolute", right: 11, bottom: 6, flexDirection: "row", alignItems: "center", gap: 5 },
  signatureLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  signatureLine: { width: 126, borderBottomWidth: 0.75, borderBottomColor: "#57605a" },
  nextTerm: { height: 26, marginTop: 5, borderWidth: 1, borderColor: "#a5c96e", borderRadius: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  nextTermBlock: { flex: 1, flexDirection: "row", alignItems: "center" },
  nextTermLabel: { color: "#177134", fontSize: 7.8, fontFamily: "Helvetica-Bold" },
  nextTermValue: { flex: 1, marginLeft: 6, paddingBottom: 1, borderBottomWidth: 0.7, borderBottomColor: "#4e594e", color: "#243527", fontSize: 7.1 },
  footer: { marginTop: 8, alignItems: "center" },
  footerText: { color: "#ffffff", backgroundColor: "#36863c", borderRadius: 5, paddingVertical: 4, paddingHorizontal: 17, fontFamily: "Helvetica-Bold", fontSize: 10.8, letterSpacing: 0.55 },
});

const palette = [
  { border: "#76b84d", text: "#37872f", badge: "#4f9c38" },
  { border: "#5aa6e4", text: "#3176b7", badge: "#3c84c4" },
  { border: "#f5aa35", text: "#e68a16", badge: "#ed981f" },
  { border: "#ef79ad", text: "#db4386", badge: "#e85093" },
  { border: "#af8cda", text: "#7756a8", badge: "#805cb1" },
  { border: "#54bfc1", text: "#258a8d", badge: "#329fa3" },
];

const subjectCards = [
  ["Mathematical Concepts", "mathematical_concepts", "mathematical concepts.png"],
  ["Writing Concepts", "writing_concepts", "writing concepts.png"],
  ["Reading", "reading", "reading.png"],
  ["Social / Emotional Development", "social_emotional_development", "social and emotional develoment.png"],
  ["God and Creation", "god_and_his_creation", "God and creation.png"],
  ["Life Skills", "life_skills", "life skils.png"],
  ["Vocabulary", "vocabulary", "vocabulary.png"],
  ["Story Telling", "story_telling", "story telling.png"],
  ["General Knowledge", "general_knowledge", "general knowledge.png"],
  ["Rhymes / Music", "rhymes_music", "rhymes, music.png"],
  ["Outdoor Activities", "outdoor_activities", "outdoor activities.png"],
  ["Punctuality", "punctuality", "punctuality.png"],
] as const;

function DottedLines({ count }: { count: number }) {
  return <>{Array.from({ length: count }, (_, index) => <View key={index} style={styles.dottedLine} />)}</>;
}

function SubjectCard({
  index,
  label,
  comment,
  artwork,
}: {
  index: number;
  label: string;
  comment?: string;
  artwork: string;
}) {
  const colour = palette[index % palette.length];
  return (
    <View style={[styles.assessmentCard, { borderColor: colour.border }]}>
      <View style={styles.artworkBox}><Image style={styles.artwork} src={nurseryAsset(artwork)} /></View>
      <View style={styles.subjectBody}>
        <View style={styles.subjectHeader}>
          <View style={[styles.numberBadge, { backgroundColor: colour.badge }]}><Text style={styles.number}>{index + 1}</Text></View>
          <Text style={[styles.subjectName, { color: colour.text }]}>{label}</Text>
        </View>
        <View style={styles.commentArea}>
          <DottedLines count={3} />
          {!!comment && <Text style={styles.subjectComment}>{comment}</Text>}
        </View>
      </View>
    </View>
  );
}

function CommentPanel({ title, comment, colour }: { title: string; comment?: string; colour: string }) {
  return (
    <View style={[styles.commentPanel, { borderColor: colour }]}>
      <View style={styles.teacherCommentBlock}>
        <View style={styles.teacherCommentLines}><DottedLines count={2} /></View>
        <Text style={styles.teacherCommentText}><Text style={[styles.teacherCommentLabel, { color: colour }]}>{title} </Text>{comment || ""}</Text>
      </View>
      <View style={styles.signatureRow}>
        <Text style={[styles.signatureLabel, { color: colour }]}>Signature:</Text>
        <View style={styles.signatureLine} />
      </View>
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
      <Image fixed src={nurseryAsset("background.png")} style={styles.background} />
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
            <View style={styles.infoCell}><Text style={styles.infoLabel}>NAME:</Text><Text style={styles.infoValue}>{formatPupilDisplayName(pupil)}</Text></View>
            <View style={styles.infoCell}><Text style={styles.infoLabel}>CLASS:</Text><Text style={styles.infoValue}>{pupilClass?.name || ""}</Text></View>
            <View style={styles.infoCellEnd}><Text style={styles.infoLabel}>AGE:</Text><Text style={styles.infoValue}>{calculateAge(pupil.dateOfBirth)}</Text></View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoCell}><Text style={styles.infoLabel}>YEAR:</Text><Text style={styles.infoValue}>{String(year)}</Text></View>
            <View style={styles.infoCell}><Text style={styles.infoLabel}>TERM:</Text><Text style={styles.infoValue}>{currentTerm?.name || ""}</Text></View>
            <View style={styles.infoCellEnd}><Text style={styles.infoLabel}>PRINT DATE:</Text><Text style={styles.infoValue}>{printDate}</Text></View>
          </View>
        </View>

        <View style={styles.reportBanner}><Text style={styles.reportBannerText}>CHILD'S PROGRESSIVE ASSESSMENT REPORT</Text></View>

        <View style={styles.assessmentGrid}>
          {Array.from({ length: 6 }, (_, rowIndex) => {
            const left = subjectCards[rowIndex * 2];
            const right = subjectCards[rowIndex * 2 + 1];
            return (
              <View key={left[1]} style={styles.assessmentRow}>
                <SubjectCard index={rowIndex * 2} label={left[0]} artwork={left[2]} comment={subjectComments?.[left[1] as SubjectCommentType]} />
                <SubjectCard index={rowIndex * 2 + 1} label={right[0]} artwork={right[2]} comment={subjectComments?.[right[1] as SubjectCommentType]} />
              </View>
            );
          })}
        </View>

        <View style={styles.comments}>
          <CommentPanel title="Class teacher's general comment:" comment={classTeacherComment} colour="#18723a" />
          <CommentPanel title="Headteacher's comment:" comment={headTeacherComment} colour="#2f78bf" />
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
