import re

with open('platform-web/app/watson-excel-validator/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

pat_recent = r'( {14}\{/\* Bottom: Recent Files \*/\}.*?)(?= {12}\{/\* Confirmed Exports Section \*/\})'
m_recent = re.search(pat_recent, text, flags=re.DOTALL)
if not m_recent:
    print("Could not find Recent Files block")
    exit(1)
recent_str = m_recent.group(1)

pat_confirm = r'( {12}\{/\* Confirmed Exports Section \*/\}.*?)(?= {10}</div>\n {8}\)\}\n\n {8}\{/\* Data Section \*/\})'
m_confirm = re.search(pat_confirm, text, flags=re.DOTALL)
if not m_confirm:
    print("Could not find Confirmed Exports block")
    exit(1)
confirm_str = m_confirm.group(1)

cut_text = text.replace(recent_str, '').replace(confirm_str, '')

recent_str_modified = recent_str.replace(
    '              <div className="w-full">\n                <Card className="border-gray-200 flex flex-col">',
    '              <div className="col-span-12 lg:col-span-4 lg:h-[calc(100vh-13rem)]">\n                <Card className="border-gray-200 flex flex-col h-full lg:min-h-105">'
).replace('{/* Bottom: Recent Files */}', '{/* Right Column: Recent Files */}')

confirm_str_modified = confirm_str.replace('<div className="mt-6">', '<div className="w-full">')
confirm_str_modified = '  ' + confirm_str_modified.replace('\n', '\n  ') # Indent more

injection_target = '''                )}
              </div>

            </div>

          </div>'''

# wait, we need to see exactly what left inside cut_text
print("Searching for injection target...")
# Let's just find "    <div className="flex flex-col gap-6">" -> "    <div className="grid grid-cols-12 gap-6 items-start">"
# And then insert

# First, replace the wrap
cut_text = cut_text.replace('<div className="flex flex-col gap-6">', '<div className="grid grid-cols-12 gap-6 items-start">\n              {/* Left Column */}\n              <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">')

# Second, find where Left column should end. It should end after the <div className="w-full space-y-4"> 's closing </div>
# The original code had:
#               </div>
# 
#             </div>
#
#          </div>

pat_end_left = r'(                  </Alert>\n                \)\}\n              </div>\n)'
m_end = re.search(pat_end_left, cut_text)
if m_end:
    replacement = m_end.group(1) + "\n" + confirm_str_modified + "            </div>\n\n" + recent_str_modified.rstrip() + "\n"
    cut_text = cut_text.replace(m_end.group(1), replacement)
    
    with open('platform-web/app/watson-excel-validator/page.tsx', 'w', encoding='utf-8') as f:
        f.write(cut_text)
    print("Success")
else:
    print("Could not find injection point")
