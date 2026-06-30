import React from 'react';
import { Editor } from '@tinymce/tinymce-react';

import 'tinymce/tinymce';
import 'tinymce/models/dom';
import 'tinymce/icons/default';
import 'tinymce/themes/silver';
import 'tinymce/plugins/advlist';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/code';
import 'tinymce/plugins/fullscreen';
import 'tinymce/plugins/image';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/table';
import '../styles/RichTextEditor.css';

const fontFamilyFormats = [
  'Arial=arial,helvetica,sans-serif',
  'Times New Roman=times new roman,times,serif',
  'Roboto=roboto,arial,sans-serif',
  'Inter=inter,arial,sans-serif',
  'Georgia=georgia,palatino,serif',
  'Tahoma=tahoma,arial,helvetica,sans-serif',
  'Verdana=verdana,geneva,sans-serif'
].join(';');

const RichTextEditor = ({
  value = '',
  onChange,
  placeholder = 'Nhap noi dung...',
  height = 420
}) => (
  <div className="rich-text-editor">
    <Editor
      value={value || ''}
      onEditorChange={(content) => onChange?.(content)}
      init={{
        height,
        menubar: false,
        branding: false,
        promotion: false,
        license_key: 'gpl',
        base_url: '/tinymce',
        suffix: '.min',
        skin_url: '/tinymce/skins/ui/oxide',
        content_css: '/tinymce/skins/content/default/content.min.css',
        plugins: 'advlist autolink code fullscreen image link lists table',
        toolbar: [
          'undo redo | blocks fontfamily fontsize | bold italic underline',
          'forecolor backcolor | alignleft aligncenter alignright alignjustify',
          'bullist numlist | link image table | fullscreen code'
        ].join(' | '),
        font_family_formats: fontFamilyFormats,
        font_size_formats: '10px 12px 14px 16px 18px 20px 24px 28px 32px 36px',
        block_formats: 'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4',
        placeholder,
        resize: true,
        min_height: 280,
        max_height: 720,
        image_title: true,
        automatic_uploads: false,
        paste_data_images: false,
        convert_urls: false,
        table_default_attributes: {
          border: '1'
        },
        table_default_styles: {
          borderCollapse: 'collapse',
          width: '100%'
        },
        content_style: `
          body {
            color: #172033;
            font-family: Inter, Arial, sans-serif;
            font-size: 16px;
            line-height: 1.65;
            margin: 14px;
          }
          body[data-mce-placeholder]::before {
            color: #94a3b8;
          }
          img {
            height: auto;
            max-width: 100%;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          table td,
          table th {
            border: 1px solid #cbd5e1;
            padding: 8px;
          }
        `
      }}
    />
  </div>
);

export default RichTextEditor;
