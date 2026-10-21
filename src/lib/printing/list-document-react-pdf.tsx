import React from 'react';
import { Text, View } from './monochrome-react-pdf';
import { LIST_DOCUMENT, listSchoolHeading } from './list-document-theme';

export function ListDocumentHeader({ schoolName, title, context = '', date = '', count = '', section = 'REGISTER' }: {
  schoolName: string; title: string; context?: string; date?: string; count?: string; section?: string;
}) {
  const school = listSchoolHeading(schoolName);
  return <View fixed wrap={false} style={{ marginBottom: 10 }}>
    <View style={{ borderBottom: '0.8 solid #666666', paddingBottom: 7, marginBottom: 8, textAlign: 'center' }}>
      <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold' }}>{school.name}</Text>
      {school.subtitle && <Text style={{ fontSize: 11, marginTop: 2 }}>{school.subtitle}</Text>}
    </View>
    <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>{title.toUpperCase()}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', borderBottom: '0.3 solid #dddddd', paddingBottom: 7, fontSize: 7.5, color: LIST_DOCUMENT.muted }}>
      <Text style={{ width: '45%' }}>{context}</Text>
      <Text style={{ width: '35%', textAlign: 'center' }}>{date}</Text>
      <Text style={{ width: '20%', textAlign: 'right' }}>{count}</Text>
    </View>
    {section && <Text style={{ fontSize: 7, marginTop: 7, fontFamily: 'Helvetica-Bold', color: LIST_DOCUMENT.muted }}>{section.toUpperCase()}</Text>}
  </View>;
}

export function ListDocumentFooter({ label = '' }: { label?: string }) {
  return <View fixed style={{ position: 'absolute', bottom: 20, left: LIST_DOCUMENT.margin, right: LIST_DOCUMENT.margin, borderTop: '0.3 solid #dddddd', paddingTop: 6, flexDirection: 'row', fontSize: 7, color: LIST_DOCUMENT.muted }}>
    <Text style={{ flex: 1 }}>{label}</Text>
    <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  </View>;
}
