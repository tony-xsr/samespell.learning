import cognatesData from "../../data/en-es-cognates.json";

export interface CognateWord {
  id: string;
  headword: string;
  reading: string;
  example: string;
  exampleVn: string;
}

export interface CognatePair {
  id: string;
  meaningVn: string;
  mnemonicVn: string;
  en: CognateWord;
  es: CognateWord;
}

export interface CognateGroup {
  id: string;
  root: string;
  latinOrigin: string;
  note: string;
  pairs: CognatePair[];
}

export interface CognateData {
  label: string;
  groups: CognateGroup[];
}

export function getCognateData(): CognateData {
  return cognatesData as CognateData;
}
