# Stefan Prodan's Blog

### Install Ruby on Windows 

Download latest version from http://rubyinstaller.org/downloads/

1. Install Ruby x64 to `C:\Ruby`
2. Install Ruby DevKit to `C:\RubyDevKit`
3. Initialize the DevKit and bind it to Ruby installation

```
cd C:\RubyDevKit
ruby dk.rb init
ruby dk.rb install
```

### Install and run Jekyll

1. Download repo
2. Enter the folder: `cd stefanprodan/`
3. If you don't have bundler installed: `gem install bundler`
3. Install Ruby gems: `bundle install`
4. Start Jekyll server: `jekyll serve`

Access local via http://localhost:4000/
