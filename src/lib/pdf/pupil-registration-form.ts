export interface RegistrationGuardianDetails {
  relationship?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface PupilRegistrationPdfDetails {
  schoolName: string;
  firstName?: string;
  lastName?: string;
  otherNames?: string;
  gender?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  religion?: string;
  className?: string;
  previousSchool?: string;
  pupilAddress?: string;
  guardians?: RegistrationGuardianDetails[];
  medicalConditions?: string;
  allergies?: string;
  medications?: string;
}

const escapeHtml = (value: string | undefined) =>
  (value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const renderValue = (value: string | undefined) => {
  const safeValue = escapeHtml(value?.trim());
  return `<span class="field-value${safeValue ? '' : ' is-empty'}">${safeValue || '&nbsp;'}</span>`;
};

const renderField = (label: string, value?: string, className = '') => `
  <div class="field ${className}">
    <span class="field-label">${escapeHtml(label)}</span>
    ${renderValue(value)}
  </div>
`;

const renderGender = (selectedValue?: string) => {
  const normalizedValue = selectedValue?.trim().toLowerCase();
  return `
    <div class="field">
      <span class="field-label">Gender</span>
      <span class="gender-options">
        <span class="check-box${normalizedValue === 'male' ? ' is-checked' : ''}"></span><span>Male</span>
        <span class="check-box${normalizedValue === 'female' ? ' is-checked' : ''}"></span><span>Female</span>
      </span>
    </div>
  `;
};

const renderGuardian = (guardian: RegistrationGuardianDetails | undefined, index: number) => {
  const relationship = guardian?.relationship?.trim() || (index === 0 ? 'Primary guardian' : 'Relationship');

  return `
    <div class="guardian-card">
      <div class="guardian-heading">
        <span class="guardian-number">G${index + 1}</span>
        <div>
          <strong>Guardian ${index + 1}</strong>
          <span>${escapeHtml(relationship)}</span>
        </div>
      </div>
      <div class="guardian-name-grid">
        ${renderField('First name', guardian?.firstName)}
        ${renderField('Surname', guardian?.lastName)}
      </div>
      ${renderField('Phone number', guardian?.phone)}
      ${renderField('Email address', guardian?.email)}
    </div>
  `;
};

export function buildPupilRegistrationPdfHtml(details: PupilRegistrationPdfDetails): string {
  const schoolName = escapeHtml(details.schoolName?.trim() || 'School Name');
  const guardians = [details.guardians?.[0], details.guardians?.[1]];

  return `
    <style>
      .registration-pdf,
      .registration-pdf * { box-sizing: border-box; }
      .registration-pdf {
        width: 190mm;
        color: #243247;
        background: #ffffff;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.25;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .document-header {
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        padding: 8px 4px 14px;
        border-bottom: 3px solid #2399e5;
      }
      .school-mark {
        width: 46px;
        height: 46px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 13px;
        color: #ffffff;
        background: linear-gradient(145deg, #157ccc, #35afea);
        font-weight: 800;
        font-size: 15px;
        letter-spacing: .5px;
      }
      .school-copy { min-width: 0; }
      .school-name {
        margin: 0 0 3px;
        color: #1c2f49;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: .3px;
        text-transform: uppercase;
      }
      .document-title {
        margin: 0;
        color: #36475d;
        font-size: 23px;
        font-weight: 700;
        letter-spacing: -.25px;
      }
      .document-badge {
        padding: 7px 10px;
        border: 1px solid #bfe5fb;
        border-radius: 999px;
        color: #1477b9;
        background: #eff9ff;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: .9px;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .instruction-strip {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 10px 0 12px;
        padding: 7px 10px;
        border-radius: 7px;
        color: #48627a;
        background: #f2f8fc;
        font-size: 10px;
      }
      .instruction-dot {
        width: 6px;
        height: 6px;
        flex: 0 0 6px;
        border-radius: 999px;
        background: #2399e5;
      }
      .form-section {
        margin-bottom: 11px;
        overflow: hidden;
        border: 1px solid #d7e1ea;
        border-radius: 10px;
        background: #ffffff;
        break-inside: avoid;
      }
      .section-header {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 8px 11px;
        border-bottom: 1px solid #dbeaf4;
        background: #f7fbfe;
      }
      .section-number {
        width: 21px;
        height: 21px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 21px;
        border-radius: 999px;
        color: #ffffff;
        background: #2399e5;
        font-size: 10px;
        font-weight: 800;
      }
      .section-header h2 {
        margin: 0;
        color: #1f4665;
        font-size: 14px;
        font-weight: 800;
      }
      .section-header p {
        margin: 1px 0 0;
        color: #718399;
        font-size: 9px;
      }
      .section-body { padding: 10px 11px 11px; }
      .details-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: 20px;
        row-gap: 9px;
      }
      .field { min-width: 0; }
      .field.is-full { grid-column: 1 / -1; }
      .field-label {
        display: block;
        margin-bottom: 2px;
        color: #607086;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: .5px;
        text-transform: uppercase;
      }
      .field-value {
        display: block;
        min-height: 20px;
        padding: 2px 2px 3px;
        overflow: hidden;
        border-bottom: 1px dotted #8293a8;
        color: #1e293b;
        font-size: 11px;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .field-value.is-empty { color: transparent; }
      .gender-options {
        min-height: 20px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 2px 2px 3px;
        border-bottom: 1px dotted #8293a8;
        color: #34445a;
        font-size: 10px;
      }
      .check-box {
        width: 11px;
        height: 11px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #8aa0b5;
        border-radius: 3px;
        background: #ffffff;
      }
      .check-box.is-checked::after {
        content: '';
        width: 5px;
        height: 5px;
        border-radius: 1px;
        background: #2399e5;
      }
      .guardians-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .guardian-card {
        min-width: 0;
        padding: 9px;
        border: 1px solid #dbe6ee;
        border-radius: 8px;
        background: #fbfdff;
      }
      .guardian-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        padding-bottom: 7px;
        border-bottom: 1px solid #e5edf3;
      }
      .guardian-number {
        width: 27px;
        height: 27px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 27px;
        border-radius: 7px;
        color: #167dbb;
        background: #e8f6fe;
        font-size: 10px;
        font-weight: 800;
      }
      .guardian-heading strong {
        display: block;
        color: #233b53;
        font-size: 11px;
      }
      .guardian-heading div > span {
        display: block;
        margin-top: 1px;
        color: #6f8193;
        font-size: 8px;
      }
      .guardian-name-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .guardian-card > .field { margin-top: 7px; }
      .medical-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px 20px;
      }
      .document-footer {
        display: grid;
        grid-template-columns: 1.35fr .65fr;
        gap: 22px;
        align-items: end;
        padding: 2px 4px 0;
      }
      .footer-note {
        grid-column: 1 / -1;
        margin: 0 0 1px;
        color: #6b7d90;
        font-size: 9px;
      }
      .signature-line {
        min-height: 27px;
        border-bottom: 1px solid #8798ab;
      }
      .signature-label {
        display: block;
        margin-top: 3px;
        color: #607086;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: .3px;
        text-transform: uppercase;
      }
      @media print {
        @page { size: A4 portrait; margin: 10mm; }
        .registration-pdf { width: 190mm; }
      }
    </style>

    <main class="registration-pdf">
      <header class="document-header">
        <div class="school-mark">TFS</div>
        <div class="school-copy">
          <p class="school-name">${schoolName}</p>
          <h1 class="document-title">Pupil Registration Form</h1>
        </div>
        <span class="document-badge">Admissions</span>
      </header>

      <div class="instruction-strip">
        <span class="instruction-dot"></span>
        <span>Complete each section clearly. Information already entered in the system is shown on the writing lines.</span>
      </div>

      <section class="form-section">
        <div class="section-header">
          <span class="section-number">1</span>
          <div>
            <h2>Pupil information</h2>
            <p>Personal and admission details</p>
          </div>
        </div>
        <div class="section-body details-grid">
          ${renderField('First name', details.firstName)}
          ${renderField('Surname', details.lastName)}
          ${renderField('Other names', details.otherNames)}
          ${renderGender(details.gender)}
          ${renderField('Date of birth', details.dateOfBirth)}
          ${renderField('Place of birth', details.placeOfBirth)}
          ${renderField('Nationality', details.nationality)}
          ${renderField('Religion', details.religion)}
          ${renderField('Class applied for', details.className)}
          ${renderField('Previous school', details.previousSchool)}
          ${renderField('Residential address', details.pupilAddress, 'is-full')}
        </div>
      </section>

      <section class="form-section">
        <div class="section-header">
          <span class="section-number">2</span>
          <div>
            <h2>Parent / guardian information</h2>
            <p>Primary contact and an additional guardian</p>
          </div>
        </div>
        <div class="section-body guardians-grid">
          ${renderGuardian(guardians[0], 0)}
          ${renderGuardian(guardians[1], 1)}
        </div>
      </section>

      <section class="form-section">
        <div class="section-header">
          <span class="section-number">3</span>
          <div>
            <h2>Medical information</h2>
            <p>Details the school should know for the pupil's care</p>
          </div>
        </div>
        <div class="section-body medical-grid">
          ${renderField('Known medical conditions', details.medicalConditions, 'is-full')}
          ${renderField('Allergies', details.allergies)}
          ${renderField('Current medications', details.medications)}
        </div>
      </section>

      <footer class="document-footer">
        <p class="footer-note">I confirm that the information provided on this form is complete and accurate.</p>
        <div>
          <div class="signature-line"></div>
          <span class="signature-label">Parent / guardian signature</span>
        </div>
        <div>
          <div class="signature-line"></div>
          <span class="signature-label">Date</span>
        </div>
      </footer>
    </main>
  `;
}
