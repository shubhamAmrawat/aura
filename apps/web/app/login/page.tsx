import Image from "next/image"

const login = () => {
  return (
    <div className="text-white text-lg font-bold absolute  left-[50%] bottom-[50%] mt-20 max-w-[90vh] border ">
      {/* image container + login form  */}
      <div className="border max-w-[90%] flex ">
        {/* left side image */}
        <div>
          <Image
            src={"https://w.wallhaven.cc/full/x8/wallhaven-x8m71o.jpg"}
            alt="girld and a boy"
            width={100}
            height={100}
          />
        </div>
        {/* right side */}
        <div>

        </div>
      </div>
    </div>
  )
}

export default login