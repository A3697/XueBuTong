// Included in [Code]. Only runtime folders owned by this installation are eligible.
var
  FusionKeepUserData, FusionKeepLogs, FusionUninstallDataOwned: Boolean;
  FusionUninstallRoot: String;
  FusionCleanupFailures: Integer;

function FusionFileAttributes(Filename: String): Cardinal;
  external 'GetFileAttributesW@kernel32.dll stdcall';
function FusionLastFileError: Cardinal;
  external 'GetLastError@kernel32.dll stdcall';

function FusionUninstallPathSafe(Filename: String): Boolean;
var Current, ParentDir, Prefix: String; Attributes: Cardinal;
begin
  Result := False;
  Current := RemoveBackslashUnlessRoot(ExpandFileName(Filename));
  Prefix := AddBackslash(FusionUninstallRoot);
  if (not SameProgramDirectory(Current, FusionUninstallRoot)) and
    (CompareText(Copy(Current, 1, Length(Prefix)), Prefix) <> 0) then Exit;
  // Check every existing ancestor, including a junction above the installation.
  repeat
    Attributes := FusionFileAttributes(Current);
    if (Attributes = $FFFFFFFF) or ((Attributes and $400) <> 0) then Exit;
    ParentDir := ExtractFileDir(Current);
    if SameProgramDirectory(Current, ParentDir) then Break;
    Current := ParentDir;
  until False;
  Result := True;
end;

function InitializeUninstall: Boolean;
var
  Form: TSetupForm;
  MessageLabel, DetailLabel: TNewStaticText;
  KeepData, KeepLogs: TNewCheckBox;
  ContinueButton, CancelButton: TNewButton;
begin
  Result := True;
  FusionKeepUserData := True;
  FusionKeepLogs := True;
  FusionUninstallRoot := RemoveBackslashUnlessRoot(ExpandFileName(ExpandConstant('{app}')));
  FusionUninstallDataOwned := HasProductDirectoryName(FusionUninstallRoot) and
    IsOwnedProgramDirectory(FusionUninstallRoot) and FusionUninstallPathSafe(FusionUninstallRoot);
  // An unattended uninstall never opts into deleting personal information.
  if UninstallSilent then Exit;
  Form := CreateCustomForm(ScaleX(490), ScaleY(270), False, True);
  try
    Form.Caption := '卸载学不通 · 数据保留';
    MessageLabel := TNewStaticText.Create(Form);
    MessageLabel.Parent := Form;
    MessageLabel.SetBounds(ScaleX(20), ScaleY(18), ScaleX(450), ScaleY(32));
    MessageLabel.Caption := '卸载程序后，是否保留以下内容？';
    KeepData := TNewCheckBox.Create(Form);
    KeepData.Parent := Form;
    KeepData.SetBounds(ScaleX(24), ScaleY(62), ScaleX(440), ScaleY(28));
    KeepData.Caption := '保留用户数据（账号、配置、登录缓存和任务记录）';
    KeepData.Checked := True;
    KeepData.Enabled := FusionUninstallDataOwned;
    KeepLogs := TNewCheckBox.Create(Form);
    KeepLogs.Parent := Form;
    KeepLogs.SetBounds(ScaleX(24), ScaleY(102), ScaleX(440), ScaleY(28));
    KeepLogs.Caption := '保留日志与诊断记录';
    KeepLogs.Checked := True;
    KeepLogs.Enabled := FusionUninstallDataOwned;
    DetailLabel := TNewStaticText.Create(Form);
    DetailLabel.Parent := Form;
    DetailLabel.SetBounds(ScaleX(24), ScaleY(148), ScaleX(440), ScaleY(64));
    DetailLabel.WordWrap := True;
    DetailLabel.Caption := '取消勾选的内容会在卸载后删除，无法恢复。保留的数据可在重新安装到同一目录后继续使用。自定义到其他目录的数据及手动导出的文件、备份不会删除。';
    if not FusionUninstallDataOwned then
      DetailLabel.Caption := '当前目录含链接或无法确认归属，本次仅卸载程序并保留全部数据。';
    ContinueButton := TNewButton.Create(Form);
    ContinueButton.Parent := Form;
    ContinueButton.SetBounds(ScaleX(274), ScaleY(226), ScaleX(98), ScaleY(28));
    ContinueButton.Caption := '继续卸载';
    ContinueButton.ModalResult := mrOk;
    ContinueButton.Default := True;
    CancelButton := TNewButton.Create(Form);
    CancelButton.Parent := Form;
    CancelButton.SetBounds(ScaleX(382), ScaleY(226), ScaleX(88), ScaleY(28));
    CancelButton.Caption := '取消';
    CancelButton.ModalResult := mrCancel;
    CancelButton.Cancel := True;
    Result := Form.ShowModal() = mrOk;
    if Result then
    begin
      FusionKeepUserData := KeepData.Checked;
      FusionKeepLogs := KeepLogs.Checked;
    end;
  finally
    Form.Free;
  end;
end;

function FusionIsLogPath(RelativePath: String): Boolean;
var P, Name, Tail: String; I: Integer;
begin
  P := Lowercase(RelativePath);
  Name := ExtractFileName(P);
  Result := (P = 'lab-logs') or (Pos('lab-logs\', P) = 1) or
    (P = 'evidence') or (Pos('evidence\', P) = 1);
  if Result then Exit;
  if Pos('private\desktop-', P) = 1 then
    Result := (CompareText(ExtractFileExt(Name), '.out') = 0) or
      (CompareText(ExtractFileExt(Name), '.err') = 0);
  if Pos('ocs-profile\', P) = 1 then
    Result := (Name = 'chrome_debug.log') or (Pos('\crashpad\', P) > 0) or (Name = 'crashpad');
  if Pos('instances\', P) = 1 then
  begin
    Tail := Copy(P, Length('instances\') + 1, Length(P));
    I := Pos('\', Tail);
    if I = 0 then Exit;
    Tail := Copy(Tail, I + 1, Length(Tail));
    Result := (Tail = 'data\logs') or (Pos('data\logs\', Tail) = 1);
    if Pos('sessions\', Tail) = 1 then
      Result := (Name = 'backend-private.log') or (Name = 'startup-state.json') or
        (Name = 'startup-state.writing') or (Name = 'startup-state.json.writing');
  end;
end;

function FusionCleanupDataFolder(RelativePath: String): Boolean;
var Folder, Filename, Child: String; F: TFindRec; Keep, ChildIsLog: Boolean; ErrorCode: Cardinal;
begin
  Result := False;
  Folder := AddBackslash(FusionUninstallRoot) + RelativePath;
  if not DirExists(Folder) then Exit;
  if not FusionUninstallPathSafe(Folder) then
  begin
    FusionCleanupFailures := FusionCleanupFailures + 1;
    Result := True;
    Exit;
  end;
  if FindFirst(AddBackslash(Folder) + '*', F) then
  begin
    try
      repeat
        if (F.Name <> '.') and (F.Name <> '..') then
        begin
          Child := AddBackslash(RelativePath) + F.Name;
          Filename := AddBackslash(Folder) + F.Name;
          ChildIsLog := FusionIsLogPath(Child);
          if ChildIsLog then Keep := FusionKeepLogs else Keep := FusionKeepUserData;
          if (F.Attributes and $400) <> 0 then
          begin
            // Never follow or delete a reparse point, even for "remove all".
            if not Keep then FusionCleanupFailures := FusionCleanupFailures + 1;
            Result := True;
          end
          else if (F.Attributes and $10) <> 0 then
          begin
            if FusionCleanupDataFolder(Child) then Result := True;
          end
          else if Keep then Result := True
          else if not Keep then
            if not DeleteFile(Filename) then
            begin
              FusionCleanupFailures := FusionCleanupFailures + 1;
              Result := True;
            end;
        end;
      until not FindNext(F);
    finally
      FindClose(F);
    end;
  end
  else
  begin
    ErrorCode := FusionLastFileError;
    if (ErrorCode <> 2) and (ErrorCode <> 18) then
    begin
      FusionCleanupFailures := FusionCleanupFailures + 1;
      Result := True;
    end;
  end;
  if FusionIsLogPath(RelativePath) then Keep := FusionKeepLogs else Keep := FusionKeepUserData;
  // RemoveDir only removes an empty directory. Retained descendants stay put.
  if Keep then Result := True;
  if not Result then
    if not RemoveDir(Folder) then
    begin
      FusionCleanupFailures := FusionCleanupFailures + 1;
      Result := True;
    end;
end;

procedure CleanupSelectedUninstallData;
var Retained: Boolean;
begin
  if (not FusionUninstallDataOwned) or (FusionKeepUserData and FusionKeepLogs) then Exit;
  FusionCleanupFailures := 0;
  Retained := FusionCleanupDataFolder('ocs-profile');
  Retained := FusionCleanupDataFolder('bridge-data') or Retained;
  Retained := FusionCleanupDataFolder('instances') or Retained;
  Retained := FusionCleanupDataFolder('private') or Retained;
  Retained := FusionCleanupDataFolder('lab-logs') or Retained;
  Retained := FusionCleanupDataFolder('evidence') or Retained;
  // The installed marker has uninsneveruninstall so retained data remains
  // recognizable by the next installation, even after registry removal.
  if FusionCleanupFailures > 0 then
    SuppressibleMsgBox('程序已卸载。部分所选数据被占用、包含链接或无法删除，已保留在原安装目录，请关闭相关程序后手动检查。', mbInformation, MB_OK, IDOK);
end;
