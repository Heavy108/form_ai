export interface DetectedField {
  id: string;
  type: 'TextBox' | 'ChoiceButton' | 'Signature' | 'DateField' | 'RadioButton' | 'ImageUpload';
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  value?: string;
  checked?: boolean;
  signatureMode?: 'upload' | 'draw' | 'text';
  imageData?: string;
  label?: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface PageInfo {
  data_url: string;
  width: number;
  height: number;
  page_number?: number;
}

export interface DetectionResult {
  request_id: string;
  pages: PageInfo[];
  fields: DetectedField[];
}
