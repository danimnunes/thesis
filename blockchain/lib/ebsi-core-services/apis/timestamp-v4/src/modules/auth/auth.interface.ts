export interface SubjectInfo {
  scp: string;
  sub: string;
}

export interface UserInfo {
  did?: string;
  login_hint: string;
  sub: string;
}
