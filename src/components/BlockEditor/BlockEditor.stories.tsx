import type { Meta, StoryObj } from '@storybook/react';
import BlockEditor from './BlockEditor';
import { useState } from 'react';
import { UploadListDialog, UploadListDialogProps } from '@/extensions/ImageUpload/components/UploadListDialog.tsx';

const meta: Meta<typeof BlockEditor> = {
  title: 'Components/Editor',
  component: BlockEditor,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    image: {
      onUploadImage: {
        action: false,
      },
    },
    onChange: {
      action: false,
    },
  },
};

export default meta;
type Story = StoryObj<typeof BlockEditor>;

export const Default: Story = {
  args: {
    content: '<p>Hello, World! 👋</p>',
    onChange: (content, isChanged, stats) => {
      console.log(content, isChanged, stats)
    },
    className: 'pr-8 pl-20 py-16 lg:pl-8 lg:pr-8',
  },
};

export const Empty: Story = {
  args: {
    content: '',
    onChange: (content, isChanged, stats) => {
      console.log(content, isChanged, stats)
    },
    className: 'pr-8 pl-20 py-16 lg:pl-8 lg:pr-8',
  },
};

export const WithRichContent: Story = {
  args: {
    // readOnly: true,
    content: `<h1>Rich Content Example</h1><p>This is a <code>paragraph</code> with <strong>bold</strong> and <em>italic</em> text.</p><ul><li><p>Bullet point 1</p></li><li><p>Bullet point 2</p></li></ul><figure data-type="blockquoteFigure"><div><blockquote><p>This is a blockquote</p></blockquote><figcaption></figcaption></div></figure><pre><code class="language-javascript">const code = "example";const code = "example";const code = "example";const code = "example";
function red() {
  String show = "hello"
}</code></pre><p><a rel="noopener noreferrer nofollow" class="link" style="">https://www.google.com/search?sca_esv=bae98e363cc9bd77&amp;rlz=1C1GCEU_koKR…amp;biw=742&amp;bih=608&amp;dpr=1#vhid=-mNI5DBCB_iEPM&amp;vssid=mosaic</a></p><img src="https://lh7-rt.googleusercontent.com/docsz/AD_4nXdYjM8OgCA8iyur01v6LLW6sGoTBcCBuO0BcC5wGwn6zt4CsBS1R9Y__igexq5flbfFqXjG7UMdQ8ehu_rnoksX6BOSdQ0Z5_7DAjjFPgxeBqMS3xMuwA1Z1rqrlkBeacfFzCVEiQ?key=CBRRLTGNOJHyn-TSr094-w" data-width="100%" data-align="center">
<img src="wizlit:Lif9WWbnfbdt1M3aTUAUQcPu7ioIfseo" data-width="100%" data-align="center">`,
    onChange: (content, isChanged, stats) => {
      console.log(content, isChanged, stats)
    },
    image: {
      maxSize: 1024 * 10,
      convertSrc: (src: string) => {
        if (!src.startsWith('wizlit:')) {
            return "EXTERNAL_IMAGE";
        }
        const fileId = src.split(':')[1];
        return `${'http://localhost:8081/api'}/file/${fileId}`;
        // if (src.startsWith('https://picsum.photos/')) {
        //   // return 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT-nxJNnslmaqKYaovp4bvsKFhzMnVJjwVlr36FgOqORNiITwLrSBw6FOjp59CyqMJ3hcY&usqp=CAU'
        // }
        // return "EXTERNAL_IMAGE"
      },
      onClick: (url, event) => {
        console.log(url, event)
      }
    },
    link: {
      disableDefaultAction: true,
      onClick: (url: string) => {
        if (url.startsWith('http')) {
          console.log(url)
        }
      },
    },
    maxCharacters: 5000,
    showDebug: true,
    className: 'pr-8 pl-20 py-16 lg:pl-8 lg:pr-8',
  },
};

export const ShortMaxCharacters: Story = {
  args: {
    content: '<p>This editor has custom styling</p>',
    maxCharacters: 100,
    showDebug: true,
    onChange: undefined,
    className: 'pr-8 pl-20 py-16 lg:pl-8 lg:pr-8',
  },
};

export const WithCustomClass: Story = {
  args: {
    content: '<p>This editor has custom styling</p>',
    className: 'bg-gray-100 p-4 rounded-lg',
    image: {
      onUploadImage: async (file: File) => {
        console.log('Image upload is disabled in the demo... Please implement the API.uploadImage method in your project.')
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5000) + 1000))
        return `https://picsum.photos/${Math.floor(Math.random() * 300) + 100}/${Math.floor(Math.random() * 200) + 100}`
      },
    },
    onChange: (content, isChanged, stats) => {
      console.log(content, isChanged, stats)
    },
  },
};

export const ChangeContent: Story = {
  render: () => {
    const [content, setContent] = useState('<p>Initial content</p>');
    const [uploadDialogProps, setUploadDialogProps] = useState<UploadListDialogProps>({} as UploadListDialogProps);
    
    const handleButtonClick = () => {
      setContent('<p>New content after button click! 🎉</p><table style="min-width: 75px"><colgroup><col style="min-width: 25px"><col style="min-width: 25px"><col style="min-width: 25px"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p>m</p></td><td colspan="1" rowspan="1"><p>fgsdf</p></td></tr><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p>fgfh</p></td><td colspan="1" rowspan="1"><p></p></td></tr><tr><td colspan="1" rowspan="1"><p>sfnf</p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p>nsdfgdfg</p></td></tr></tbody></table><div data-youtube-video=""><iframe width="640" height="480" allowfullscreen="true" autoplay="false" disablekbcontrols="false" enableiframeapi="false" endtime="0" ivloadpolicy="0" loop="false" modestbranding="false" origin="" playlist="" rel="1" src="https://www.youtube-nocookie.com/embed/HuaGOfzVBiU?rel=1" start="0"></iframe></div><p>Test youtube</p><img src="https://picsum.photos/366/217" data-width="100%" data-align="center"><p>Test Image</p>');
    };

    return (
      <div className="flex flex-col gap-4 p-4 h-screen relative">
        <div className="flex justify-end">
          <button 
            onClick={handleButtonClick}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Change Content
          </button>
        </div>
        
        <BlockEditor
          content={content}
          onChange={(newContent, isChanged, stats) => {
            console.log('Content changed:', newContent, isChanged, stats);
          }}
          className="pr-8 pl-20 py-16 lg:pl-8 lg:pr-8"
          showDebug
          maxCharacters={1000}
          altCharacterCounter
          maxEmbeddings={8}
          image={{
            disableBuiltInUploadDialog: true,
            getUploadDialogProps: props => {
              setUploadDialogProps(props)
            }
          }}
        />

        <UploadListDialog
          {...uploadDialogProps}
          className="fixed bottom-4 left-4"
        />
      </div>
    );
  },
}; 