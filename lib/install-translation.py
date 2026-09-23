"""Install the English→Japanese Argos model in the voice data directory."""

import argostranslate.package

installed = argostranslate.package.get_installed_packages()
if not any(item.from_code == "en" and item.to_code == "ja" for item in installed):
    argostranslate.package.update_package_index()
    package = next((item for item in argostranslate.package.get_available_packages()
                    if item.from_code == "en" and item.to_code == "ja"), None)
    if package is None:
        raise SystemExit("The Argos package index has no English→Japanese model")
    print("Downloading English-to-Japanese translation model...", flush=True)
    argostranslate.package.install_from_path(package.download())
print("English-to-Japanese translation model ready", flush=True)
