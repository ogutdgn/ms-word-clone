# Mailings Tab — Feature Status

_A real mail-merge engine. Verified by 9 tests (136/136 total) + MS Word oracle (`mail_probe.ps1`)._

## Create
- ✅ **Envelopes** (delivery/return address → envelope-sized page), **Labels** (Avery 5160 3×10 etc. → label grid table)

## Start Mail Merge
- ✅ **Start Mail Merge** (Letters/E-mail/Envelopes/Labels/Directory/Wizard), **Select Recipients** (Type a New List = editable grid, Use an Existing List = CSV import via file dialog), **Edit Recipient List**

## Write & Insert Fields
- ✅ **Insert Merge Field** (`«Field»` placeholders — syntax matches real Word), **Address Block** & **Greeting Line** (composite fields), **Highlight Merge Fields** (shading toggle), **Rules** (If/Fill-in/Ask/Next Record… approximated), **Match Fields** (auto), **Update Labels**

## Preview Results
- ✅ **Preview Results** toggle — replaces `«fields»` with the current recipient's data; **First/Previous/Next/Last** + **Go to Record** spinner; **Find Recipient**; **Check for Errors** (flags unmatched fields)

## Finish
- ✅ **Finish & Merge** — Edit Individual Documents (one filled copy per recipient, page-break between), Print Documents; Send Email Messages = documented stub (no mail backend)

## Real-Word validation (`mail_probe.ps1`)
- ✅ MailMerge scriptable; types Letters=0/Envelopes=1/Labels=2/Directory=3/Email=4
- ✅ Merge field syntax `«FirstName»` matches Word's `{ MERGEFIELD FirstName }` display
