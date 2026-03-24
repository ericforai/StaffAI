import os
import re
import json
import glob

directories = [
    "design", "engineering", "game-development", "marketing", "paid-media",
    "product", "project-management", "sales", "spatial-computing",
    "specialized", "support", "testing"
]

results = {}

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

for folder in directories:
    pattern = os.path.join("/Users/user/agency-agents", folder, "**/*.md")
    for file_path in glob.glob(pattern, recursive=True):
        if os.path.basename(file_path) == "README.md":
            continue
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Extract YAML frontmatter
            match = re.search(r'^---\s*(.*?)\s*---', content, re.DOTALL)
            if match:
                frontmatter = match.group(1)
                name_match = re.search(r'^name:\s*(.*)$', frontmatter, re.MULTILINE)
                desc_match = re.search(r'^description:\s*(.*)$', frontmatter, re.MULTILINE)
                
                if name_match and desc_match:
                    name = name_match.group(1).strip().strip('"').strip("'")
                    description = desc_match.group(1).strip().strip('"').strip("'")
                    
                    slug = slugify(name)
                    
                    if slug in results:
                        # Handle duplicate slugs by using the filename
                        filename_slug = slugify(os.path.basename(file_path)[:-3])
                        # If filename_slug starts with folder- remove it
                        if filename_slug.startswith(folder + "-"):
                            filename_slug = filename_slug[len(folder)+1:]
                        slug = filename_slug

                    results[slug] = {
                        "name": name,
                        "description": description,
                        "file": file_path # for debugging
                    }

with open('/Users/user/agency-agents/agents_data.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print(f"Extracted {len(results)} agents.")
